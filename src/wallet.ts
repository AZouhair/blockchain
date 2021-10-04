import {ec} from 'elliptic';
import {existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync} from 'fs';
import {getPublicKey, getTransactionId, signTransIn, Transaction, TransIn, TransOut, UnspentTransOut} from './transaction';

const EC = new ec('secp256k1');
const privateKeyLocation = process.env.PRIVATE_KEY || './wallet/private_key';

const getPrivateFromWallet = (): string => {
    const buffer = readFileSync(privateKeyLocation, 'utf8');
    return buffer.toString();
};

const getPublicFromWallet = (): string => EC.keyFromPrivate(getPrivateFromWallet(), 'hex')
                                            .getPublic()
                                            .encode('hex', true);


const generatePrivateKey = (): string => EC.genKeyPair().getPrivate().toString(16);

const initWallet = () => {
    // Keep the same key if it exists
    if (existsSync(privateKeyLocation)) {
        return;
    };

    const newPrivateKey = generatePrivateKey();
    // Build the folder if it doesn't exist
    try {
        const lastDelimiter = privateKeyLocation.lastIndexOf('/');
        mkdirSync(privateKeyLocation.substring(0, lastDelimiter), { recursive: true } );
        writeFileSync(privateKeyLocation, newPrivateKey);
        console.log(`new wallet with private key created to: ${privateKeyLocation}`);
    } catch (e) {
        console.log('Cannot create folder ', e);
    };

};

const deleteWallet = () => {
    if (existsSync(privateKeyLocation)) {
        unlinkSync(privateKeyLocation);
    }
};

const getBalance = (address: string, unspentTransOuts: UnspentTransOut[] | null): number => {
    return findUnspentTransOuts(address, unspentTransOuts)
        .map((unspentTrans: UnspentTransOut) => unspentTrans.amount)
        .reduce((a,b)=>a+b);
};

const findUnspentTransOuts = (ownerAddress: string, unspentTransOuts: UnspentTransOut[] | null) => {
    return unspentTransOuts ? unspentTransOuts.filter((uTransO: UnspentTransOut) => uTransO.address === ownerAddress) : [];
};

const findTransOutsForAmount = (amount: number, myUnspentTransOuts: UnspentTransOut[]) => {
    let currentAmount = 0;
    const includedUnspentTransOuts = [];
    for (const myUnspentTransOut of myUnspentTransOuts) {
        includedUnspentTransOuts.push(myUnspentTransOut);
        currentAmount = currentAmount + myUnspentTransOut.amount;
        if (currentAmount >= amount) {
            const leftOverAmount = currentAmount - amount;
            return {includedUnspentTransOuts, leftOverAmount};
        }
    }

    const eMsg = `Required amount: ${amount}. Only ${currentAmount} available for the transactions: ${JSON.stringify(myUnspentTransOuts)}`;
    throw Error(eMsg);
};

const createTransOuts = (receiverAddress: string, myAddress: string, amount: number, leftOverAmount: number) => {
    const transOut: TransOut = new TransOut(receiverAddress, amount);
    if (leftOverAmount > 0) {
        const leftOverTrans = new TransOut(myAddress, leftOverAmount);
        return [transOut, leftOverTrans];
        
    } else {
        return [transOut];
    }
};

const filterTransPooltransactions = (unspentTransOuts: UnspentTransOut[], transactionPool: Transaction[]): UnspentTransOut[] => {
    const transIns: TransIn[] = transactionPool
        .map((trans: Transaction) => trans.transIns)
        .flat();

    const removable: UnspentTransOut[] = [];
    for (const unspentTransOut of unspentTransOuts) {
        const transIn = transIns.find( (aTransIn: TransIn) => {
            return aTransIn.transOutIndex === unspentTransOut.transOutIndex && aTransIn.transOutId === unspentTransOut.transOutId;
        });

        if (transIn === undefined) {

        } else {
            removable.push(unspentTransOut);
        }
    }

    return unspentTransOuts.filter(element => !removable.includes(element));
};

const createTransaction = (receiverAddress: string, amount: number, privateKey: string,
                           unspentTransOuts: UnspentTransOut[] , transPool: Transaction[]): Transaction => {

    const myAddress: string = getPublicKey(privateKey);
    const myUnspentTransOutsA = unspentTransOuts.filter((uTransO: UnspentTransOut) => uTransO.address === myAddress);

    const myUnspentTransOuts = filterTransPooltransactions(myUnspentTransOutsA, transPool);

    // filter from unspentOutputs such inputs that are referenced in pool
    const {includedUnspentTransOuts, leftOverAmount} = findTransOutsForAmount(amount, myUnspentTransOuts);

    const toUnsignedTransIn = (unspentTransOut: UnspentTransOut) => {
        const transIn: TransIn = new TransIn();
        transIn.transOutId = unspentTransOut.transOutId;
        transIn.transOutIndex = unspentTransOut.transOutIndex;
        return transIn;
    };

    const unsignedTransIns: TransIn[] = includedUnspentTransOuts.map(toUnsignedTransIn);

    const trans: Transaction = new Transaction();
    trans.transIns = unsignedTransIns;
    trans.transOuts = createTransOuts(receiverAddress, myAddress, amount, leftOverAmount);
    trans.id = getTransactionId(trans);

    trans.transIns = trans.transIns.map((transIn: TransIn, index: number) => {
        transIn.signature = signTransIn(trans, index, privateKey, unspentTransOuts);
        return transIn;
    });

    console.log(`Current Transaction Pool: ${JSON.stringify(transPool)}`);

    return trans;
};

export {createTransaction, getPublicFromWallet,
    getPrivateFromWallet, getBalance, generatePrivateKey, initWallet, deleteWallet, findUnspentTransOuts};

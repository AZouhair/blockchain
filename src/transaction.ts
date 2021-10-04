import * as CryptoJS from 'crypto-js';
import * as ecdsa from 'elliptic';
import { UnspentTransOut as UnspentTransOutInterface } from './interfaces';
import { toHexString } from './util';


const ec = new ecdsa.ec('secp256k1');

const COINBASE_AMOUNT: number = 100;

// Transactions consists of two components: inputs and outputs. 
// Outputs specify where the coins are sent and inputs give a proof that 
// the coins that are actually sent exists in the first place and are owned by the “sender”. 
// Inputs always refer to an existing (unspent) output.

export class Transaction {

    public id!: string;

    public transIns!: TransIn[];
    public transOuts!: TransOut[];

    toString = () => ``;
}


export class TransIn {
    public transOutId!: string;
    public transOutIndex!: number;
    public signature!: string;

    toString = () => ``;
}

export class TransOut {
    public address: string;
    public amount: number;

    constructor(address: string, amount: number) {
        this.address = address;
        this.amount = amount;
    };

    toString = () => ``;
}

export class UnspentTransOut implements UnspentTransOutInterface {
    readonly transOutId: string;
    readonly transOutIndex: number;
    readonly address: string;
    readonly amount: number;

    constructor(transOutId: string, transOutIndex: number, address: string, amount: number) {
        this.transOutId = transOutId;
        this.transOutIndex = transOutIndex;
        this.address = address;
        this.amount = amount;
    };

    toString = () => ``;

}



const getTransactionId = (transaction: Transaction): string => {
    const transInContent: string = transaction.transIns
        .map((transIn: TransIn) => transIn.transOutId + transIn.transOutIndex)
        .reduce((a, b) => a + b, '');

    const transOutContent: string = transaction.transOuts
        .map((transOut: TransOut) => transOut.address + transOut.amount)
        .reduce((a, b) => a + b, '');

    return CryptoJS.SHA256(transInContent + transOutContent).toString();
};

const validateTransaction = (transaction: Transaction, aUnspentTransOuts: UnspentTransOut[]): boolean => {

    if (!isValidTransactionStructure(transaction)) {
        return false;
    }

    if (getTransactionId(transaction) !== transaction.id) {
        console.log(`invalid trans id: ${transaction.id}`);
        return false;
    }
    const hasValidTransIns: boolean = transaction.transIns
        .map((transIn) => validateTransIn(transIn, transaction, aUnspentTransOuts))
        .reduce((a, b) => a && b, true);

    if (!hasValidTransIns) {
        console.log(`some of the transIns are invalid in trans: ${transaction.id}`);
        return false;
    }

    const totalTransInValues: number = transaction.transIns
        .map((transIn) => getTransInAmount(transIn, aUnspentTransOuts))
        .reduce((a, b) => (a + b), 0);

    const totalTransOutValues: number = transaction.transOuts
        .map((transOut) => transOut.amount)
        .reduce((a, b) => (a + b), 0);

    if (totalTransOutValues !== totalTransInValues) {
        console.log(`totalTransOutValues !== totalTransInValues in trans: ${transaction.id}`);
        return false;
    }

    return true;
};

const validateBlockTransactions = (aTransactions: Transaction[], aUnspentTransOuts: UnspentTransOut[], blockIndex: number): boolean => {
    const coinbaseTrans = aTransactions[0];
    if (!validateCoinbaseTrans(coinbaseTrans, blockIndex)) {
        console.log(`invalid coinbase transaction: ${JSON.stringify(coinbaseTrans)}`);
        return false;
    }

    // check for duplicate transIns. Each transIn can be included only once
    const transIns: TransIn[] = aTransactions
        .map((trans: any) => trans.transIns)
        .flat();

    if (hasDuplicates(transIns)) {
        return false;
    }

    // all but coinbase transactions
    const normalTransactions: Transaction[] = aTransactions.slice(1);
    return normalTransactions.map((trans) => validateTransaction(trans, aUnspentTransOuts))
        .reduce((a, b) => (a && b), true);

};


function countBy(data: any[], getKey: any) {
    let count: any = {};
    for (let row of data) {
        let key = getKey(row);
        count[key] = (count[key] || 0) + 1;
    }
    return count;
}


const hasDuplicates = (transIns: TransIn[]): boolean => {
    const groups = Object.entries(countBy(transIns, (transIn: TransIn) => transIn.transOutId + transIn.transOutIndex));

    return groups.map((key, value) => {
            if (value > 1) {
                console.log(`duplicate transIn: ${key}`);
                return true;
            } else {
                return false;
            }
        })
        .includes(true);
};

const validateCoinbaseTrans = (transaction: Transaction, blockIndex: number): boolean => {
    if (transaction == null) {
        console.log('the first transaction in the block must be coinbase transaction');
        return false;
    }
    if (getTransactionId(transaction) !== transaction.id) {
        console.log(`invalid coinbase trans id: ${transaction.id}`);
        return false;
    }
    if (transaction.transIns.length !== 1) {
        console.log('one transIn must be specified in the coinbase transaction');
        return false;
    }
    if (transaction.transIns[0].transOutIndex !== blockIndex) {
        console.log('the transIn signature in coinbase trans must be the block height');
        return false;
    }
    if (transaction.transOuts.length !== 1) {
        console.log('invalid number of transOuts in coinbase transaction');
        return false;
    }
    if (transaction.transOuts[0].amount !== COINBASE_AMOUNT) {
        console.log('invalid coinbase amount in coinbase transaction');
        return false;
    }
    return true;
};

const validateTransIn = (transIn: TransIn, transaction: Transaction, aUnspentTransOuts: UnspentTransOut[]): boolean => {
    const referencedUTransOut = aUnspentTransOuts.find((uTransO) => uTransO.transOutId === transIn.transOutId && uTransO.transOutIndex === transIn.transOutIndex);

    if (referencedUTransOut == null) {
        console.log(`referenced transOut not found: ${JSON.stringify(transIn)}`);
        return false;
    }
    const address = referencedUTransOut.address;

    const key = ec.keyFromPublic(address, 'hex');
    const validSignature: boolean = key.verify(transaction.id, transIn.signature);
    if (!validSignature) {
        console.log(`invalid transIn signature: ${transIn.signature} transId: ${transIn.signature} address: ${referencedUTransOut.address}`);
        return false;
    }
    return true;
};

const getTransInAmount = (transIn: TransIn, aUnspentTransOuts: UnspentTransOut[]): number => {

    const UnspentTransOut = findUnspentTransOut(transIn.transOutId, transIn.transOutIndex, aUnspentTransOuts);

    return UnspentTransOut? UnspentTransOut.amount : 0;
};

const findUnspentTransOut = (transactionId: string, index: number, aUnspentTransOuts: UnspentTransOut[]): UnspentTransOut | null => {
    const unspentTransOut = aUnspentTransOuts.find((uTransO) => uTransO.transOutId === transactionId && uTransO.transOutIndex === index);
    return unspentTransOut ? unspentTransOut : null;
};

const getCoinbaseTransaction = (address: string, blockIndex: number): Transaction => {
    const t = new Transaction();
    const transIn: TransIn = new TransIn();
    transIn.signature = '';
    transIn.transOutId = '';
    transIn.transOutIndex = blockIndex;

    t.transIns = [transIn];
    t.transOuts = [new TransOut(address, COINBASE_AMOUNT)];
    t.id = getTransactionId(t);
    return t;
};

// It is important that the contents of the transaction cannot be altered, after it has been signed.
// As the transactions are public, anyone can access to the transactions, even before they are included in the blockchain.

const signTransIn = (transaction: Transaction, transInIndex: number,
                  privateKey: string, aUnspentTransOuts: UnspentTransOut[]): string => {
    const transIn: TransIn = transaction.transIns[transInIndex];

    const dataToSign = transaction.id;
    const referencedUnspentTransOut = findUnspentTransOut(transIn.transOutId, transIn.transOutIndex, aUnspentTransOuts);
    if (referencedUnspentTransOut == null) {
        console.log('could not find referenced transOut');
        throw Error();
    }
    const referencedAddress = referencedUnspentTransOut.address;

    if (getPublicKey(privateKey) !== referencedAddress) {
        console.log('trying to sign an input with private key that does not match the address that is referenced in transIn');
        throw Error();
    }
    const key = ec.keyFromPrivate(privateKey, 'hex');
    const signature: string = toHexString(key.sign(dataToSign).toDER());

    return signature;
};

const updateUnspentTransOuts = (aTransactions: Transaction[], aUnspentTransOuts: UnspentTransOut[]): UnspentTransOut[] => {
    const newUnspentTransOuts: UnspentTransOut[] = aTransactions
        .map((t) => {
            return t.transOuts.map((transOut, index) => new UnspentTransOut(t.id, index, transOut.address, transOut.amount));
        })
        .reduce((a, b) => a.concat(b), []);

    const consumedTransOuts: UnspentTransOut[] = aTransactions
        .map((t) => t.transIns)
        .reduce((a, b) => a.concat(b), [])
        .map((transIn) => new UnspentTransOut(transIn.transOutId, transIn.transOutIndex, '', 0));

    const resultingUnspentTransOuts = aUnspentTransOuts
        .filter(((uTransO) => !findUnspentTransOut(uTransO.transOutId, uTransO.transOutIndex, consumedTransOuts)))
        .concat(newUnspentTransOuts);

    return resultingUnspentTransOuts;
};

const processTransactions = (aTransactions: Transaction[], aUnspentTransOuts: UnspentTransOut[], blockIndex: number) => {

    if (!validateBlockTransactions(aTransactions, aUnspentTransOuts, blockIndex)) {
        console.log('invalid block transactions');
        return null;
    }
    return updateUnspentTransOuts(aTransactions, aUnspentTransOuts);
};


const getPublicKey = (aPrivateKey: string): string => {
    return ec.keyFromPrivate(aPrivateKey, 'hex').getPublic().encode('hex', true); //TODO
};

const isValidTransInStructure = (transIn: TransIn): boolean => {
    if (transIn == null) {
        console.log('transIn is null');
        return false;
    } else if (typeof transIn.signature !== 'string') {
        console.log('invalid signature type in transIn');
        return false;
    } else if (typeof transIn.transOutId !== 'string') {
        console.log('invalid transOutId type in transIn');
        return false;
    } else if (typeof  transIn.transOutIndex !== 'number') {
        console.log('invalid transOutIndex type in transIn');
        return false;
    } else {
        return true;
    }
};

const isValidTransOutStructure = (transOut: TransOut): boolean => {
    if (transOut == null) {
        console.log('transOut is null');
        return false;
    } else if (typeof transOut.address !== 'string') {
        console.log('invalid address type in transOut');
        return false;
    } else if (!isValidAddress(transOut.address)) {
        console.log('invalid TransOut address');
        return false;
    } else if (typeof transOut.amount !== 'number') {
        console.log('invalid amount type in transOut');
        return false;
    } else {
        return true;
    }
};

const isValidTransactionStructure = (transaction: Transaction) => {
    if (typeof transaction.id !== 'string') {
        console.log('transactionId missing');
        return false;
    }
    if (!(transaction.transIns instanceof Array)) {
        console.log('invalid transIns type in transaction');
        return false;
    }
    if (!transaction.transIns
            .map(isValidTransInStructure)
            .reduce((a, b) => (a && b), true)) {
        return false;
    }

    if (!(transaction.transOuts instanceof Array)) {
        console.log('invalid transIns type in transaction');
        return false;
    }

    if (!transaction.transOuts
            .map(isValidTransOutStructure)
            .reduce((a, b) => (a && b), true)) {
        return false;
    }
    return true;
};

// valid address is a valid ecdsa public key in the 04 + X-coordinate + Y-coordinate format
const isValidAddress = (address: string): boolean => {
    if (address.length !== 130) {
        console.log(address);
        console.log('invalid public key length');
        return false;
    } else if (address.match('^[a-fA-F0-9]+$') === null) {
        console.log('public key must contain only hex characters');
        return false;
    } else if (!address.startsWith('04')) {
        console.log('public key must start with 04');
        return false;
    }
    return true;
};

export {
    processTransactions, signTransIn, getTransactionId, isValidAddress, validateTransaction,
    getCoinbaseTransaction, getPublicKey, hasDuplicates
};

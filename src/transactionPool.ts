import {validateTransaction} from './transaction';
import {Transaction, TransIn, UnspentTransOut} from './interfaces'
import {deepCopy} from './util';

let transactionPool: Transaction[] = [];

const isValidTransForPool = (trans: Transaction, aTtransactionPool: Transaction[]): boolean => {
    const transPoolIns: TransIn[] = getTransPoolIns(aTtransactionPool);

    const containsTransIn = (transIns: TransIn[], transIn: TransIn) => {
        return transPoolIns.find( ((transPoolIn) => {
            return transIn.transOutIndex === transPoolIn.transOutIndex && transIn.transOutId === transPoolIn.transOutId;
        }));
    };

    for (const transIn of trans.transIns) {
        if (containsTransIn(transPoolIns, transIn)) {
            console.log('transIn already found in the transPool');
            return false;
        }
    }
    return true;
};

const getTransactionPool = () => {
    return deepCopy(transactionPool);
};

const addToTransactionPool = (trans: Transaction, unspentTransOuts: UnspentTransOut[] | null) => {

    if ( !unspentTransOuts) {
        throw Error('Trying to add invalid trans to pool');
    }

    else if (!validateTransaction(trans, unspentTransOuts)) {
        throw Error('Trying to add invalid trans to pool');
    }

    if (!isValidTransForPool(trans, transactionPool)) {
        throw Error('Trying to add invalid trans to pool');
    }
    console.log(`adding to transPool: ${JSON.stringify(trans)}`);
    transactionPool.push(trans);
};

const cleanTransactionPool = (unspentTransOuts: UnspentTransOut[]) => {
    const invalidtransactions: Transaction[] = [];

    for (const trans of transactionPool) {
        for (const transIn of trans.transIns) {
            if (!hasTransIn(transIn, unspentTransOuts)) {
                invalidtransactions.push(trans);
                break;
            }
        }
    }
    
    if (invalidtransactions.length > 0) {
        console.log(`removing the following transactions from transPool: ${JSON.stringify(invalidtransactions)}`);
        transactionPool = transactionPool.filter( element => !invalidtransactions.includes(element) );
    }
};

const hasTransIn = (transIn: TransIn, unspentTransOuts: UnspentTransOut[]): boolean => {
    const foundTransIn = unspentTransOuts.find((uTransO: UnspentTransOut) => {
        return uTransO.transOutId === transIn.transOutId && uTransO.transOutIndex === transIn.transOutIndex;
    });
    return foundTransIn !== undefined;
};

const getTransPoolIns = (aTransactionPool: Transaction[]): TransIn[] => {
    return aTransactionPool
        .map(element => element.transIns)
        .flat()
};


export {addToTransactionPool, getTransactionPool, cleanTransactionPool};

import  Block, { calculateHash, isValidNewBlock }  from './block';
import {broadcastLatest, broadCastTransactionPool} from './socket';
import {addToTransactionPool, getTransactionPool, cleanTransactionPool} from './transactionPool';
import {deepCopy, getCurrentTimestamp, hexToBinary} from './util';
import { getCoinbaseTransaction, isValidAddress, processTransactions, Transaction, UnspentTransOut } from './transaction';
import {createTransaction, findUnspentTransOuts, getBalance, getPrivateFromWallet, getPublicFromWallet} from './wallet';


// INITIAL Block and Transaction
const genesisTransaction = {
    'transIns': [{'signature': '', 'transOutId': '', 'transOutIndex': 0}],
    'transOuts': [{
        'address': 'rubberaddress',
        'amount': 50
    }],
    'id': 'rubberid'
};

const genesisBlock: Block = new Block(
    0, 'rubberhash', '', 1465154705, [genesisTransaction], 0, 0
);

// Declaring the Blockchain

let blockchain: Block[] = [genesisBlock];


// the unspent transOut of genesis block is set to unspentTransOuts on startup
let unspentTransOuts: UnspentTransOut[] | null= processTransactions(blockchain[0].data, [], 0);

const getBlockchain = (): Block[] => blockchain;

const getUnspentTransOuts = (): UnspentTransOut[] => {
    const copyUnspentTransOuts=  deepCopy(unspentTransOuts);
    return copyUnspentTransOuts ? copyUnspentTransOuts : [];
};

// and transPool should be only updated at the same time
const setUnspentTransOuts = (newUnspentTransOut: UnspentTransOut[]) => {
    console.log(`replacing unspentTransouts with: ${newUnspentTransOut}`);
    unspentTransOuts = newUnspentTransOut;
};

const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

// in seconds
const BLOCK_GENERATION_INTERVAL: number = 30;

// in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 20;

const getDifficulty = (blockchainToTest: Block[]): number => {
    const latestBlock: Block = blockchainToTest[blockchain.length - 1];
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, blockchainToTest);
    } else {
        return latestBlock.difficulty;
    }
};

const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
    const prevAdjustmentBlock: Block = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected: number = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken: number = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.difficulty + 1;
    } else if (timeTaken > timeExpected * 2) {
        return prevAdjustmentBlock.difficulty - 1;
    } else {
        return prevAdjustmentBlock.difficulty;
    }
};

const generateRawNextBlock = (blockData: Transaction[]) => {
    const previousBlock: Block = getLatestBlock();
    const difficulty: number = getDifficulty(getBlockchain());
    const nextIndex: number = previousBlock.index + 1;
    const nextTimestamp: number = getCurrentTimestamp();
    const newBlock: Block = findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty);
    if (addBlockToChain(newBlock)) {
        broadcastLatest();
        return newBlock;
    } else {
        return null;
    }

};

// gets the unspent transaction outputs owned by the wallet
const getMyUnspentTransactionOutputs = () => {
    return findUnspentTransOuts(getPublicFromWallet(), getUnspentTransOuts());
};

const generateNextBlock = () => {
    const coinbaseTrans: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
    const blockData: Transaction[] = [coinbaseTrans].concat(getTransactionPool());
    return generateRawNextBlock(blockData);
};

const generatenextBlockWithTransaction = (receiverAddress: string, amount: number) => {
    if (!isValidAddress(receiverAddress)) {
        throw Error('invalid address');
    }
    if (typeof amount !== 'number') {
        throw Error('invalid amount');
    }
    const coinbaseTrans: Transaction = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
    const trans: Transaction = createTransaction(receiverAddress, amount, getPrivateFromWallet(), getUnspentTransOuts(), getTransactionPool());
    const blockData: Transaction[] = [coinbaseTrans, trans];
    return generateRawNextBlock(blockData);
};

const findBlock = (index: number, previousHash: string, timestamp: number, data: Transaction[], difficulty: number): Block => {
    let nonce = 0;
    while (true) {
        const hash: string = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
        }
        nonce++;
    }
};

const getAccountBalance = (): number => {
    return getBalance(getPublicFromWallet(), getUnspentTransOuts());
};

const sendTransaction = (address: string, amount: number): Transaction => {
    const trans: Transaction = createTransaction(address, amount, getPrivateFromWallet(), getUnspentTransOuts(), getTransactionPool());
    addToTransactionPool(trans, getUnspentTransOuts());
    broadCastTransactionPool();
    return trans;
};


const getAccumulatedDifficulty = (blockchainToTest: Block[]): number => {
    return blockchainToTest
        .map((block) => block.difficulty)
        .map((difficulty) => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
};



const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
    const hashInBinary: string | null = hexToBinary(hash);
    const requiredPrefix: string = '0'.repeat(difficulty);
    return hashInBinary? hashInBinary.startsWith(requiredPrefix) : false;
};

/*
    Checks if the given blockchain is valid. Return the unspent transOuts if the chain is valid
 */
const isValidChain = (blockchainToValidate: Block[]): UnspentTransOut[] | null => {
    console.log('isValidChain:');
    console.log(JSON.stringify(blockchainToValidate));
    const isValidGenesis = (block: Block): boolean => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };

    if (!isValidGenesis(blockchainToValidate[0])) {
        return null;
    }
    /*
    Validate each block in the chain. The block is valid if the block structure is valid
      and the transaction are valid
     */
    let aUnspentTransOuts: UnspentTransOut[] | null = [];

    for (let i = 0; i < blockchainToValidate.length; i++) {
        const currentBlock: Block = blockchainToValidate[i];
        if (i !== 0 && !isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return null;
        }

        aUnspentTransOuts = processTransactions(currentBlock.data, aUnspentTransOuts, currentBlock.index);
        if (aUnspentTransOuts === null) {
            console.log('invalid transactions in blockchain');
            return null;
        }
    }
    return aUnspentTransOuts;
};

const addBlockToChain = (newBlock: Block): boolean => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        const unspentTransOuts = getUnspentTransOuts();
        const retVal = unspentTransOuts ? processTransactions(newBlock.data, unspentTransOuts, newBlock.index) : null;
        if (retVal === null) {
            console.log('block is not valid in terms of transactions');
            return false;
        } else {
            blockchain.push(newBlock);
            setUnspentTransOuts(retVal);
            cleanTransactionPool(unspentTransOuts);
            return true;
        }
    }
    return false;
};

const replaceChain = (newBlocks: Block[]) => {
    const aUnspentTransOuts = isValidChain(newBlocks);
    if (aUnspentTransOuts &&
        getAccumulatedDifficulty(newBlocks) > getAccumulatedDifficulty(getBlockchain())) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain = newBlocks;
        if (aUnspentTransOuts) setUnspentTransOuts(aUnspentTransOuts);
        if (unspentTransOuts) cleanTransactionPool(unspentTransOuts);
        broadcastLatest();
    } else {
        console.log('Received blockchain invalid');
    }
};

const handleReceivedTransaction = (transaction: Transaction) => {
    addToTransactionPool(transaction, getUnspentTransOuts());
};


  

export {
    getBlockchain, getUnspentTransOuts, getLatestBlock, sendTransaction,
    generateRawNextBlock, generateNextBlock, generatenextBlockWithTransaction,
    handleReceivedTransaction, getMyUnspentTransactionOutputs,
    getAccountBalance, replaceChain, addBlockToChain
};

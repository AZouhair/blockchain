import CryptoJS from 'crypto-js';
import { Transaction } from "./transaction";
import { getCurrentTimestamp, hexToBinary } from './util';
import { Block as BlockInterface} from './interfaces';


class Block implements BlockInterface {

    index: number;
    hash: string;
    previousHash: string;
    timestamp: number;
    data: Transaction[];
    difficulty: number;
    nonce: number;

    constructor(index: number, hash: string, previousHash: string,
                timestamp: number, data: Transaction[], difficulty: number, nonce: number) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
        this.difficulty = difficulty;
        this.nonce = nonce;
    };

    toString = () => `Block at ${this.timestamp} contains the Transactions : ${JSON.stringify (this.data)}`;

};


export const calculateHashForBlock = (block: Block): string =>
    calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);

export const calculateHash = (index: number, previousHash: string, timestamp: number, data: Transaction[],
                       difficulty: number, nonce: number): string =>
    CryptoJS.SHA256(index + previousHash + timestamp + data + difficulty + nonce).toString();

export const isValidBlockStructure = (block: Block): boolean => {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'object';
};

export const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
    if (!isValidBlockStructure(newBlock)) {
        console.log(`invalid block structure: ${JSON.stringify(newBlock)}`);
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    } else if (!isValidTimestamp(newBlock, previousBlock)) {
        console.log('invalid timestamp');
        return false;
    } else if (!hasValidHash(newBlock)) {
        return false;
    }
    return true;
};

// Checking the timestamp s important in order to avoid attacks 
// where the difficulty is manipulated using a false timstamp.

export const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
    return ( previousBlock.timestamp - 60 < newBlock.timestamp )
        && newBlock.timestamp - 60 < getCurrentTimestamp();
};

export const hashMatchesBlockContent = (block: Block): boolean => {
    const blockHash: string = calculateHashForBlock(block);
    return blockHash === block.hash;
};

export const hasValidHash = (block: Block): boolean => {

    if (!hashMatchesBlockContent(block)) {
        console.log(`invalid hash ${block.hash}`);
        return false;
    }

    if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
        console.log(`block difficulty not satisfied. Expected: ${block.difficulty} got: ${block.hash}`);
    }
    return true;
};

// The Proof-of-work puzzle is to find a block hash, that has a specific number of zeros prefixing it. 
// The difficulty property defines how many prefixing zeros the block hash must have, in order for the block to be valid. 
// The prefixing zeros are checked from the binary format of the hash.

const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
    const hashInBinary: string | null = hexToBinary(hash);
    const requiredPrefix: string = '0'.repeat(difficulty);
    return hashInBinary? hashInBinary.startsWith(requiredPrefix) : false;
};


export default Block ;

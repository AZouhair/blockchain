import { MessageType } from "./enums";

// Block and Blockchain 
export interface Block {

    index: number;
    hash: string;
    previousHash: string;
    timestamp: number;
    data: Transaction[];
    difficulty: number;
    nonce: number;

    toString(): string;

};

// Transactions 
export interface UnspentTransOut {
    readonly transOutId: string;
    readonly transOutIndex: number;
    readonly address: string;
    readonly amount: number;

    toString(): string;

}

export interface TransIn {
    transOutId: string;
    transOutIndex: number;
    signature: string;

    toString(): string;
}

export interface TransOut {
    address: string;
    amount: number;

    toString(): string;
}

export interface Transaction {

    id: string;
    transIns: TransIn[];
    transOuts: TransOut[];

    toString(): string;
}

//Misc
export interface Message {
    type: MessageType;
    data: any;

    toString(): string;
}

export interface LookUpTable {
    [key: string]: string | undefined
}

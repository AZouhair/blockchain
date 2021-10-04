import WebSocket from 'ws';
import {Server} from 'ws';
import Block, { isValidBlockStructure } from './block';
import { MessageType } from './enums';
import { Message as MessageInterface } from './interfaces';
import {Transaction} from './transaction';
import {getTransactionPool} from './transactionPool';
import {addBlockToChain, getBlockchain, getLatestBlock, handleReceivedTransaction, replaceChain} from './blockchain';

const sockets: WebSocket[] = [];

class Message implements MessageInterface{
    public type!: MessageType;
    public data: any;

    toString = () => ``;
}

const initSocket = (socketPort: number) => {
    const server: Server = new WebSocket.Server({port: socketPort});
    server.on('connection', (ws: WebSocket) => {
        initConnection(ws);
    });
    console.log('listening websocket on: ' + socketPort);
};

const getSockets = () => sockets;

const initConnection = (ws: WebSocket) => {
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, queryChainLengthMsg());
    setTimeout(() => {
        broadcast(queryTransactionPoolMsg());
    }, 1000);
};



const initMessageHandler = (ws: WebSocket) => {
    ws.on('message', (data: string) => {

        try {
            const message: Message | null=JSON.parse(data);
            if (message === null) {
                console.log(`could not parse received JSON message: ${data}`);
                return;
            }
            console.log(`Received message: ${JSON.stringify(message)}`);
            switch (message.type) {
                case MessageType.QUERY_LATEST:
                    write(ws, responseLatestMsg());
                    break;
                case MessageType.QUERY_ALL:
                    write(ws, responseChainMsg());
                    break;
                case MessageType.RESPONSE_BLOCKCHAIN:
                    const receivedBlocks: Block[] | null = JSON.parse(message.data);
                    if (receivedBlocks === null) {
                        console.log(`invalid blocks received: ${JSON.stringify(message.data)}`);
                        break;
                    }
                    handleBlockchainResponse(receivedBlocks);
                    break;
                case MessageType.QUERY_TRANSACTION_POOL:
                    write(ws, responseTransactionPoolMsg());
                    break;
                case MessageType.RESPONSE_TRANSACTION_POOL:
                    const receivedTransactions: Transaction[] | null = JSON.parse(message.data);
                    if (receivedTransactions === null) {
                        console.log(`invalid transaction received: ${JSON.stringify(message.data)}`);
                        break;
                    }
                    receivedTransactions.forEach((transaction: Transaction) => {
                        try {
                            handleReceivedTransaction(transaction);
                            broadCastTransactionPool();
                        } catch (e : any) {
                            console.log(e.message);
                        }
                    });
                    break;
            }
        } catch (e) {
            console.log(e);
        }
    });
};

const write = (ws: WebSocket, message: Message): void => ws.send(JSON.stringify(message));
const broadcast = (message: Message): void => sockets.forEach((socket) => write(socket, message));

const queryChainLengthMsg = (): Message => ({'type': MessageType.QUERY_LATEST, 'data': null});

const queryAllMsg = (): Message => ({'type': MessageType.QUERY_ALL, 'data': null});

const responseChainMsg = (): Message => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN, 'data': JSON.stringify(getBlockchain())
});

const responseLatestMsg = (): Message => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN,
    'data': JSON.stringify([getLatestBlock()])
});

const queryTransactionPoolMsg = (): Message => ({
    'type': MessageType.QUERY_TRANSACTION_POOL,
    'data': null
});

const responseTransactionPoolMsg = (): Message => ({
    'type': MessageType.RESPONSE_TRANSACTION_POOL,
    'data': JSON.stringify(getTransactionPool())
});

const initErrorHandler = (ws: WebSocket) => {
    const closeConnection = (myWs: WebSocket) => {
        console.log('connection failed to peer: ' + myWs.url);
        sockets.splice(sockets.indexOf(myWs), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
};

const handleBlockchainResponse = (receivedBlocks: Block[]) => {
    if (receivedBlocks.length === 0) {
        console.log('received block chain size of 0');
        return;
    }
    const latestBlockReceived: Block = receivedBlocks[receivedBlocks.length - 1];
    if (!isValidBlockStructure(latestBlockReceived)) {
        console.log('block structuture not valid');
        return;
    }
    const latestBlockHeld: Block = getLatestBlock();
    if (latestBlockReceived.index > latestBlockHeld.index) {
        console.log('blockchain possibly behind. We got: '
            + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            if (addBlockToChain(latestBlockReceived)) {
                broadcast(responseLatestMsg());
            }
        } else if (receivedBlocks.length === 1) {
            console.log('We have to query the chain from our peer');
            broadcast(queryAllMsg());
        } else {
            console.log('Received blockchain is longer than current blockchain');
            replaceChain(receivedBlocks);
        }
    } else {
        console.log('received blockchain is not longer than received blockchain. Do nothing');
    }
};

const broadcastLatest = (): void => {
    broadcast(responseLatestMsg());
};

const connectToPeers = (newPeer: string): void => {
    const ws: WebSocket = new WebSocket(newPeer);
    ws.on('open', () => {
        initConnection(ws);
    });
    ws.on('error', () => {
        console.log('connection failed');
    });
};

const broadCastTransactionPool = () => {
    broadcast(responseTransactionPoolMsg());
};

export {connectToPeers, broadcastLatest, broadCastTransactionPool, initSocket, getSockets};

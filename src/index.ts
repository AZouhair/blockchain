import express from 'express';
import Block from './block';
import {
    generateNextBlock, generatenextBlockWithTransaction, generateRawNextBlock, getAccountBalance,
    getBlockchain, getMyUnspentTransactionOutputs, getUnspentTransOuts, sendTransaction
} from './blockchain';
import {connectToPeers, getSockets, initSocket} from './socket';
import {UnspentTransOut} from './transaction';
import {getTransactionPool} from './transactionPool';
import {getPublicFromWallet, initWallet} from './wallet';

const httpPort: number = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : 3001;
const p2pPort: number = process.env.P2P_PORT ? parseInt(process.env.P2P_PORT) : 6001;

const initHttpServer = (myHttpPort: number) => {
    const app = express();

    app.use(express.json());
    
    app.use((err:any, _req:any, res:any, _next:any) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });

    app.get('/blocks', (req, res) => {
        res.send(getBlockchain());
    });

    app.get('/block/:hash', (req, res) => {
        const block = getBlockchain().find(element => {element.hash == req.params.hash});
        res.send(block);
    });

    app.get('/transaction/:id', (req, res) => {
        const trans = (getBlockchain())
            .map((blocks: { data: any; }) => blocks.data)
            .flat() 
            .find( element => {element.id == req.params.id});
        res.send(trans);
    });

    app.get('/address/:address', (req, res) => {
        const unspentTransOuts: UnspentTransOut[] = getUnspentTransOuts().filter((uTransO) => uTransO.address === req.params.address);
        res.send({'unspentTransOuts': unspentTransOuts});
    });

    app.get('/unspentTransactionOutputs', (req, res) => {
        res.send(getUnspentTransOuts());
    });

    app.get('/myUnspentTransactionOutputs', (req, res) => {
        res.send(getMyUnspentTransactionOutputs());
    });

    app.post('/mineRawBlock', (req, res) => {
        if (req.body.data == null) {
            res.send('data parameter is missing');
            return;
        }
        const newBlock: Block | null = generateRawNextBlock(req.body.data);
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.post('/mineBlock', (req, res) => {
        const newBlock: Block | null = generateNextBlock();
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.get('/balance', (req, res) => {
        const balance: number = getAccountBalance();
        res.send({'balance': balance});
    });

    app.get('/address', (req, res) => {
        const address: string = getPublicFromWallet();
        res.send({'address': address});
    });

    app.post('/mineTransaction', (req, res) => {
        const address = req.body.address;
        const amount = req.body.amount;
        try {
            const resp = generatenextBlockWithTransaction(address, amount);
            res.send(resp);
        } catch (e : any) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

    app.post('/sendTransaction', (req, res) => {
        try {
            const address = req.body.address;
            const amount = req.body.amount;

            if (address === undefined || amount === undefined) {
                throw Error('invalid address or amount');
            }
            const resp = sendTransaction(address, amount);
            res.send(resp);
        } catch (e : any) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

    app.get('/transactionPool', (req, res) => {
        res.send(getTransactionPool());
    });

    app.get('/peers', (req, res) => {
        res.send(getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', (req, res) => {
        connectToPeers(req.body.peer);
        res.send();
    });

    app.post('/stop', (req, res) => {
        res.send({'msg' : 'stopping server'});
        process.exit();
    });

    app.listen(myHttpPort, () => {
        console.log('Listening http on port: ' + myHttpPort);
    });
};

initHttpServer(httpPort);
initSocket(p2pPort);
initWallet();

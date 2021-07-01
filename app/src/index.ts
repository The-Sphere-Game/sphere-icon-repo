import * as fs from 'fs';
import { Config } from './Config';
import { Log } from './Log';
import { GrpcClient } from 'grpc-bchrpc-node';
import express from 'express';


let client = null; // set in init - for grpc

const tokenIdToGroupIdMap = new Map(); // cache
async function getGroupIdFromTokenId(tokenId: string): Promise<string|null> { // either string on success or null
    if (tokenIdToGroupIdMap.has(tokenId)) { // do cache lookup first
        return tokenIdToGroupIdMap.get(tokenId);
    }


    const metadata = await client.getTokenMetadata([ tokenId ]);
    const list = metadata.getTokenMetadataList();
    if (list.length < 1) {
        return null;
    }

    const item = list[0];
    const tokenType = item.getTokenType();


    // group
    if (tokenType === 0x81) {
        tokenIdToGroupIdMap.set(tokenId, tokenId);
        return tokenId;
    }

    // child
    if (tokenType === 0x41) {
        const data = item.getV1Nft1Child();
        const groupTokenId = Buffer.from(data.getGroupId()).toString('hex');
        tokenIdToGroupIdMap.set(tokenId, groupTokenId);
        return groupTokenId;
    }

    return null;
}


// responds with 
function getCardUtil(res: express.Response, tokenId: string, size: string) {
    try {
        const path = `./cache/${size}/${tokenId}.png`;
        if (! fs.existsSync(path)) {
            return res.sendStatus(404);
        }

        const buf = fs.readFileSync(path);

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': buf.length,
            'Cache-Control': `max-age=86400`,
        });
        res.end(buf);
    } catch (e) {
        Log.error(`${JSON.stringify(e)}`);
    }
}

// redirect to /cards route which allows browsers and apps better caching
async function attemptRedirectUtil(res: express.Response, tokenId: string, size: string) {
    try {
        const groupTokenId = await getGroupIdFromTokenId(tokenId);
        if (! groupTokenId) {
            return res.sendStatus(404);
        }

        if (! groupTokenIds.has(groupTokenId)) {
            return res.sendStatus(404);
        }

        return res.redirect(301, `${Config.basepath}/cards/${size}/${groupTokenId}`);
    } catch (e) {
        Log.error(`${JSON.stringify(e)}`);
    }
}



async function init_server(app): Promise<void> {
    const server = app.listen(Config.port, Config.host, async () => {
        Log.info(`sphere icon repo listening on ${Config.host}:${Config.port}`);
    });

    let connections = [];
    server.on('connection', (connection): void => {
        connections.push(connection);
        connection.on('close', () => connections = connections.filter(curr => curr !== connection));
    });

    function shutDown(): void {
        Log.info('Received kill signal, shutting down gracefully');
        server.close(() => {
            Log.info('Closed out remaining connections');
            process.exit(0);
        });

        setTimeout(() => {
            Log.error('Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 10000);

        connections.forEach(curr => curr.end());
        setTimeout(() => connections.forEach(curr => curr.destroy()), 5000);
    }

    process.on('SIGTERM', shutDown);
    process.on('SIGINT', shutDown);
};

let groupTokenIds = new Set();

async function init(): Promise<void> {
    client = new GrpcClient({ url: Config.bchdUrl });
    fs
        .readdirSync('./cards')
        .forEach((file) => {
            const [hash, ext] = file.split('.');
            groupTokenIds.add(hash);
        });

    const app: express.Application = express();
    app.set('trust proxy', 1); // for forwarding of X-forwarded-for
    app.set('x-powered-by', 0); // disable x-powered-by header

    const router: express.Router = express.Router();

    // these are used to show the sole cards
    router.get('/cards/original/:tokenId', async (req: express.Request, res: express.Response) => getCardUtil(res, req.params.tokenId, 'original'));
    router.get('/cards/32/:tokenId',       async (req: express.Request, res: express.Response) => getCardUtil(res, req.params.tokenId, '32'));
    router.get('/cards/64/:tokenId',       async (req: express.Request, res: express.Response) => getCardUtil(res, req.params.tokenId, '64'));
    router.get('/cards/128/:tokenId',      async (req: express.Request, res: express.Response) => getCardUtil(res, req.params.tokenId, '128'));

    // these redirect to /cards if available
    router.get('/original/:tokenId', async (req: express.Request, res: express.Response) => attemptRedirectUtil(res, req.params.tokenId, 'original'));
    router.get('/32/:tokenId',       async (req: express.Request, res: express.Response) => attemptRedirectUtil(res, req.params.tokenId, '32'));
    router.get('/64/:tokenId',       async (req: express.Request, res: express.Response) => attemptRedirectUtil(res, req.params.tokenId, '64'));
    router.get('/128/:tokenId',      async (req: express.Request, res: express.Response) => attemptRedirectUtil(res, req.params.tokenId, '128'));

    app.use(Config.basepath, router);

    init_server(app);
}

init();

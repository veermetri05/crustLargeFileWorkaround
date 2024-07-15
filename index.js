import { create } from 'kubo-rpc-client'
import { ethers } from 'ethers';
import { createHelia } from 'helia'
import { CID } from 'multiformats/cid'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bootstrap } from '@libp2p/bootstrap'
import { identify } from '@libp2p/identify'
import { tcp } from '@libp2p/tcp'
import { createLibp2p } from 'libp2p'
import * as dagPb from '@ipld/dag-pb'
import { UnixFS } from 'ipfs-unixfs';
import { unixfs } from '@helia/unixfs';
import { FsBlockstore } from 'blockstore-fs';
import { FsDatastore } from 'datastore-fs';
import axios from 'axios';
import qs from 'qs';

const blockstore = new FsBlockstore('./blockstore')
const datastore = new FsDatastore('./datastore')

const libp2p = await createLibp2p({
    datastore,
    addresses: {
        listen: [
            '/ip4/127.0.0.1/tcp/0'
        ]
    },
    transports: [
        tcp()
    ],
    connectionEncryption: [
        noise()
    ],
    streamMuxers: [
        yamux()
    ],
    peerDiscovery: [
        bootstrap({
            list: [
                '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
                '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
                '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
                '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
            ]
        })
    ],
    services: {
        identify: identify()
    }
})
const helia = await createHelia(datastore, blockstore, libp2p)
const fs = unixfs(helia)
const node = await helia.blockstore.get(CID.parse("youCID"))
const dagNode = dagPb.decode(node)
let myCIDs = []
for (const link in dagNode.Links) {
    const linkObj = dagNode.Links[link]

    if (linkObj.Size > 100000000) {
        console.log("Big block issue")
    } else {
        myCIDs.push({ hash: linkObj.Hash.toString(), size: linkObj.Tsize })
    }
}
const ipfs = create({
    url: `https://crustipfs.xyz/api/v0`,
    headers: {
        authorization: `Bearer c3ViLWNUTjFRcWJjOGNmdmVER2RrZmdERUFVRnRQb0g2UHJZMjlCZmpBUzRHb0ROVUN1VDI6MHgxY2E0NTY4Y2Y1ODM2Mzc2MWU2MjBkYWFjOTliMDM0MjY2ZDc0MDBkNWE0MTMxYmYyYjI0NGI5NzllZmRkZTFjZDgyY2I5MWUwMDcyZTYxOWExOGY1MzE0ZmEyOGE4OWJhYjg2YmI2ZmRlMzhiYzc1YzNhZDc4ZTE1MDIwZGQ4MA==`
    }
});
const cid = await ipfs.dag.put(node, { storeCodec: "dag-pb", inputCodec: "dag-pb" })
console.log(cid)
console.log(myCIDs.length)
myCIDs = ((myCIDs.filter(cid => !doneList.includes(cid.hash))))
console.log(myCIDs.length)

async function addFile(fileCid) {
    const pair = ethers.Wallet.createRandom();
    const sig = await pair.signMessage(pair.address);
    const authHeaderRaw = `eth-${pair.address}:${sig}`;
    const authHeader = Buffer.from(authHeaderRaw).toString('base64');
    const ipfsW3GW = 'https://crustipfs.xyz';

    // 1. Create IPFS instant
    const ipfs = create({
        url: `${ipfsW3GW}/api/v0`,
        headers: {
            authorization: `Basic ${authHeader}`
        }
    });

    // 2. Add file to ipfs
    let success = false;
    let cid;
    while (!success) {
        try {
            cid = await ipfs.add(fs.cat(CID.parse(fileCid)));
            if (cid) {
                success = true;
            }
        } catch (error) {
            console.log(error)
            console.log("error occured")
        }
    }
    console.log("File added successfully")

    const fileStat = await ipfs.files.stat("/ipfs/" + cid.path);

    return {
        cid: cid.path,
        size: fileStat.cumulativeSize
    };
}
let i = 0;
for (const cid of myCIDs) {
    const result = await addFile(cid.hash)
    console.log(result.cid)

    const urlEncodedData = qs.stringify({
        cid: result.cid,
        name: "demo" + i++
    })
    axios.post("https://pin.crustcode.com/psa/pins/", urlEncodedData, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.207.132.170 Safari/537.36",
            Authorization: "Bearer c3ViLWNUTjFRcWJjOGNmdmVER2RrZmdERUFVRnRQb0g2UHJZMjlCZmpBUzRHb0ROVUN1VDI6MHgxY2E0NTY4Y2Y1ODM2Mzc2MWU2MjBkYWFjOTliMDM0MjY2ZDc0MDBkNWE0MTMxYmYyYjI0NGI5NzllZmRkZTFjZDgyY2I5MWUwMDcyZTYxOWExOGY1MzE0ZmEyOGE4OWJhYjg2YmI2ZmRlMzhiYzc1YzNhZDc4ZTE1MDIwZGQ4MA=="
        }
    })
        .then(response => {
            console.log('Response:', response.data);
        })
        .catch(error => {
            console.error('Error:', error.response ? error.response.data : error.message);
        });
}


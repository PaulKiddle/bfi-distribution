# BFI Distribution Browser

Can be used either as an API client library in node, or as a webserver.

## Node

`npm install https://github.com/PaulKiddle/bfi-distribution`

```javascript
import * as distribution from 'bfi-distribution';

// Fetch the latest catalog and use
const config = await distribution.fetchCatalog();
const catalog = new distribution.Catalog(config);

// Alternatively, save config to and read from a json file
await distribution.saveTo('distribution.json');
const catalog = await distribution.load('distribution.json');

```

## Webserver

```bash
git clone https://github.com/PaulKiddle/bfi-distribution

cd bfi-distribution
npm i
npm run prepare
npm run catalog
npm run dev
```

import fs from 'fs';
import parseSpreadsheet from './read.js';
import Catalog, {type CatalogSource, Entry} from './catalog.js';

export {
	Catalog,
	Entry
}

const distributionPage = 'https://www.bfi.org.uk/bfi-distribution';


async function getFilenameAndData(source: string) {
	if(source.startsWith('https:') || source.startsWith('https:')) {
		const download = await fetch(source);
		const disposition = download.headers.get('content-disposition');

		const filename = disposition?.split('=')[1] ?? source;
		if(!filename.endsWith('.xlsx')) {
			throw new Error(`Downloaded file is not .xlsx: ${filename}`);
		}
		const data = Buffer.from(await download.arrayBuffer());
		return { filename, data };
	}

	if(!source.includes(':')) {
		const data = await fs.promises.readFile(source);
		return { filename: source, data };
	}

	throw new Error(`Don't know how to fetch source ${source}`)
}


export async function fetchCatalog(sourceFileOrUrl?: string) {
	if(!sourceFileOrUrl) {
		const pageText = await (await fetch(distributionPage)).text();
		const catalogPageUrl = pageText.match(/href="(https:\/\/[^:\/]+.bfi\.org\.uk\/[^"]+)"((?!<\/a>).)+BFI Distribution catalogue/)?.[1];

		if(!catalogPageUrl) {
			throw new Error(`Could not find distribution spreadsheet at URL ${distributionPage}`);
		}

		sourceFileOrUrl = catalogPageUrl;
	}

	const { filename, data } = await getFilenameAndData(sourceFileOrUrl);
	const date = filename.match(/\d{4}-\d{2}-\d{2}/)?.[0];

	return await parseSpreadsheet(data, date);
}

export async function saveTo(localPath: string, sourceFileOrUrl?: string) {
	const data = await fetchCatalog(sourceFileOrUrl);
	const json = JSON.stringify(data, null, 2);
	await fs.promises.writeFile(localPath, json);
}

export async function load(dataOrPath: string|CatalogSource) {
	if(typeof dataOrPath === 'string') {
		dataOrPath = JSON.parse(await fs.promises.readFile(dataOrPath, 'utf-8')) as CatalogSource;
	}

	return new Catalog(dataOrPath);
}

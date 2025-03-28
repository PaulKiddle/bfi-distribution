import readXlsxFile, { readSheetNames } from 'read-excel-file/node';
import type { CatalogSource, Row, Warning } from './catalog.js';

class ArraySet extends Set {
	toJSON(){
		return Array.from(this.values());
	}
}

type L = 'genre'|'filmFormat'
type R = Omit<Row, L> & Record<L, ArraySet>;

export default async function parseSpreadsheet(data: Buffer, date: string|undefined): Promise<CatalogSource> {
	const sheet = (await readSheetNames(data)).at(-1);
	const [titles, ...catalog] = await readXlsxFile(data, { sheet });


	const columns = titles.map(k=>({
		title: k,
		key: String(k).toLowerCase().replaceAll(/ ([a-z])/g, ($0, $1)=>$1.toUpperCase()) as keyof R
	}));

	const records: R[] = [];

	const differs: Warning[] = [];

	for(const row of catalog) {
		const { genre, filmFormat, ...record } = Object.fromEntries(columns.map(
			({ key }, ix) => [
				key,
				typeof row[ix] === 'string' ? row[ix].replaceAll(/\n((?!\n)\s)*(?=\n)/g, '\n').replaceAll(/\n{3,}/g, '\n\n') : row[ix]
			]
		)) as unknown as R;

		const r = records.findLast(r=>{
			if(r.title !== record.title) {
				return false;
			}

			const differFields = Object.entries(record)
				.filter(([key, value]) => r[key as keyof R] !== value);

			if(differFields.length) {
				differs.push({
					title: r.title,
					fields: differFields.map(([key, value]) => [key, value, r[key as keyof R]])
				});
				return false;
			}
			return true;
		});

		if(r) {
			if(genre) {
				r.genre.add(genre);
			}
			if(filmFormat) {
				r.filmFormat.add(filmFormat);
			}
		} else {
			const r = {
				...record,
				genre: new ArraySet(genre ? [genre] : []),
				filmFormat: new ArraySet(filmFormat ? [filmFormat] : [])
			};
			records.push(r);
		}
	}

	return {
		date,
		columns,
		records: records.map(r => ({ ...r, genre: r.genre.toJSON(), filmFormat: r.filmFormat.toJSON() })),
		warnings: differs
	}
}

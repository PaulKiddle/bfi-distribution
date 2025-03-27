import Catalog from '../converter/catalog.ts';
import catalog from '../distribution.json';

export const certificates = [
	'U', 'PG', '12', '12A', '15', '18', 'Exempt'
];

function getCountryList(data: string|null|number) {
	if(typeof data !== 'string') {
		return [];
	}

 	return data.split(/[\-\,\/]/).map(s=>s.trim())
}

function getPictureList(data: string|null) {
	return data ? data.toLowerCase().split(',').map(s=>s.trim()) : [];
}

export const formats = [...new Set(catalog.records.flatMap(r=>r.filmFormat))]
export const genres = [...new Set(catalog.records.flatMap(r=>r.genre))].filter((v): v is string => !!v);
export const countries = [...new Set(catalog.records.flatMap(r=>getCountryList(r.country)))].sort();
export const pictures = [...new Set(catalog.records.flatMap(r=>getPictureList(r.picture)))]

export default new Catalog({ ...catalog, warnings:[] });

export const date = catalog.date;
export const columns = catalog.columns;

import RegExp_escape from 'regexp.escape'

export type Row = Record<
		'title'|
		'alphabeticalTitle' |
		'cast' |
		'certificate' |
		'country' |
		'duration' |
		'year'
		,
	string|number|null> & 
	Record<'director' |
		'picture' |
		'shortSynopsis' |
		'originalTitle', string|null> &
	{
		longSynopsis: string,
		genre: string[],
		filmFormat: string[]
};

export type Warning = any;

export const certificates = [
	'U', 'PG', '12', '12A', '15', '18', 'Exempt'
];

export type CatalogSource = {
	records: Row[],
	date: string|undefined,
	warnings: Warning[],
	columns: any[]
};

	function getCountryList(data: string|null|number) {
		if(typeof data !== 'string') {
			return [];
		}

		return data.split(/[\-\,\/]/).map(s=>s.trim())
	}

	function getPictureList(data: string|null) {
		return data ? data.toLowerCase().split(',').map(s=>s.trim()) : [];
	}

	function stringable<T>(data: T[], string: string) {
		return Object.assign(
			data,
			{
				toString(){
					return string;
				}
			}
		);
	}

	function splitOn(data: string|null|number, r: RegExp) {
		if(!data) {
			return null;
		}

		const string = String(data);

		return stringable(
			string.split(r).map(v=>v.trim()),
			string
		);
	}

	function matchDirectors(data: string|null) {
		if(!data) {
			return null;
		}

		const single = data.match(/^([a-z]+),\s+([a-z]+)$/i);
		
		const list = single ? [`${single[2]} ${single[1]}`] : data.split(/[,&;]|\band\b/i).map(s=>s.trim());

		return stringable(
			list,
			data
		)
	}

	function matchDurations(data: string|null|number) {
		if(!data) {
			return null;
		}
		const list = (typeof data === 'number') ? [data] : Array.from(data.matchAll(/\b[0-9]+\b/ig)).map(n=>parseInt(n[0], 10));

		return stringable(list, String(data))
	}

	function* matchYears(data: string|number|null) {
		if(!data) {
			return;
		}

		if(typeof data === 'number') {
			yield data;
			return;
		}

		const [date0, ...dates] = [...data.matchAll(/\b[0-9]+\b/g)].map(d=>d[0]);

		let lastDate = date0;

		yield parseInt(lastDate, 10);

		for(const date of dates) {
			if(date.length < 4) {
				lastDate = lastDate.slice(0, -date.length)+date
			} else {
				lastDate = date;
			}

			yield parseInt(lastDate, 10);
		}
	}

	function compareNumbers(listA: number[]|null, listB: number[]|null, desc = false) {
		const first = desc ? Math.max : Math.min;
		const [a, b] = [listA, listB].map(e => e ? first(...e) : null);


		if(a === b) {
			return 0;
		}
		if(!Number.isFinite(a)) {
			return 1;
		}
		if(!Number.isFinite(b)) {
			return -1;
		}

		return desc ? b!-a! : a!-b!;
	}

	const toRegex = (term: string|RegExp, flags = 'iug') => { 
		if(typeof term === 'string') {
			return new RegExp(
				RegExp_escape(term)
				//.replaceAll(/(?<!\\(x[a-z0-9]?)?)[a-z]/gi, ($0)=>($0+String.raw`\p{Diacritic}*`))
				,
				flags);
		}
		return term;
	}

	export class Entry {
		title
		#sortTitle
		cast
		#cast
		certificate
		countries
		#countries
		directors
		#directors
		#durations
		duration
		format
		genre
		picture
		#pictures
		originalTitle
		year
		#years
		synopsis
		warnings: string[]
		#normal: Record<string, (string|null)[]> = {};

		constructor(row: Row){
			this.warnings = []
			this.title = String(row.title);
			this.#sortTitle = String(row.alphabeticalTitle)
			this.cast = row.cast;
			if(typeof row.cast === 'number') {
				this.warnings.push('Cast is a number')
			}
			const cast = this.#cast = splitOn(row.cast, /[,&;]|\band\b/i);
			// if(cast?.some(c=>!c.includes(' '))) {
			// 	this.warnings.push('Cast contains a name without a space')
			// }
			this.certificate = row.certificate ? String(row.certificate) : null;
			this.countries = row.country;
			if(typeof row.country === 'number') {
				this.warnings.push('Country is a number')
			}
			this.#countries = getCountryList(row.country);
			this.directors = row.director;
			this.#directors = matchDirectors(row.director);
			this.duration = row.duration
			if(typeof row.duration === 'string' && row.duration.match(/\b(?!min|and)[a-z]+|[^- ,/a-z0-9]/)) {
				this.warnings.push('Duration contains ambiguous data');
			}
			this.#durations = matchDurations(row.duration);
			this.format = row.filmFormat;
			this.genre = row.genre.filter((v): v is string => !!v);
			this.picture = row.picture;
			this.#pictures = getPictureList(row.picture);
			this.originalTitle = row.originalTitle
			this.year = row.year;
			if((typeof row.year === 'string') && !row.year.match(/[0-9]{4}/)) {
				this.warnings.push('Year does not contain a 4-digit year')
			}
			this.#years = Array.from(matchYears(row.year));
			if(row.shortSynopsis?.match(/<\/?[a-z]+/) || row.longSynopsis?.match(/<\/?[a-z]+/)) {
				this.warnings.push('Synopsis contains HTML tags')
			}
			const short = row.shortSynopsis?.split(/\n+/) ?? [];
			const long = row.longSynopsis?.split(/\n/) ?? [];
			this.synopsis = Object.assign(row.longSynopsis.includes(row.shortSynopsis!) ? long : short.concat(long), {
				short,
				long
			});
		}

		compareTitle(other: Entry, desc: boolean = false) {
			const [b, a] = desc ? [this, other] : [other, this];
			return a.#sortTitle.localeCompare(b.#sortTitle);
		}

		compareCertificate(other: Entry, desc: boolean = false) {
			const [a, b] = [this, other].map(e=>certificates.indexOf(e.certificate!));

			if(a === b) {
				return 0;
			}
			if(a < 0) {
				return 1;
			}
			if(b < 0) {
				return -1;
			}

			return desc ? b-a : a-b;
		}

		compareDuration(other: Entry, desc: boolean = false) {
			return compareNumbers(this.#durations, other.#durations, desc);
		}

		compareYear(other: Entry, desc: boolean = false) {
			return compareNumbers(this.#years, other.#years, desc);
		}

		highlight<T>(string: RegExp|string|null, mark: (s: string)=>T) {
			if(!string) {
				return this.synopsis;
			}
			const matcher = toRegex(string, 'ig');
			return this.synopsis.map(line => {
				const parts: (string|T)[] = [];

				let ix = 0;
				for(const match of line.matchAll(matcher)) {
					parts.push(match.input.slice(ix, match.index), mark(match[0]));
					ix = match.index+match[0].length;
				}
				parts.push(line.slice(ix));

				return parts;
			});
		}


		#matchesTargets(string: string|RegExp, targets: (string|undefined|null)[]){
			const matcher = toRegex(string);
			const diacritic = /\p{Diacritic}/gu;
			
			if(!diacritic.test(matcher.source.normalize('NFD'))) {
				targets = targets.map(t=>t?.normalize('NFD').replaceAll(diacritic, '')??null)
			}
			return targets.some(target => target?.match(matcher));
		}

		matchesSynopsis(string: string|RegExp){
			return this.#matchesTargets(string, this.synopsis);
		}

		matchesTitle(string: string|RegExp){
			const targets = [this.title, this.#sortTitle, this.originalTitle];
			return this.#matchesTargets(string, targets);
		}

		matchesPerson(string: string|RegExp){
			const targets = [
				String(this.cast??''),
				this.directors,
				...this.#cast??[], ...this.#directors??[]
			];

			return this.#matchesTargets(string, targets);
		}

		hasCountry(c: string) {
			return this.#countries.includes(c);
		}

		hasPictureType(p: string) {
			return this.#pictures.includes(p);
		}
	}


export type QueryParams = {
	sort?: {
		by: string|null,
		desc?: boolean
	}
	search?: {
		term: string|null
		field: string|null
	}
	filter?: {
		certificate: string|null,
		format: string|null,
		genre: string|null,
		country: string|null,
		picture: string|null,
	}
};


export default class Catalog {
	date
	records
	warnings

	constructor(catalog: CatalogSource) {
		this.date = catalog.date;
		this.records = catalog.records.map(r => new Entry(r));
		this.warnings = catalog.warnings;
	}


	query({ sort, search, filter }: QueryParams){
		const rows = this.records;
		const query = search?.term?.toLowerCase();

		const filters: ((r: Entry) => boolean)[] = [];

		if(query) {
			if(search?.field === 'title') {
				filters.push(r => !!r.matchesTitle(query))
			} else if(search?.field === 'people') {
				filters.push(r => !!r.matchesPerson(query))
			} else {
				filters.push(r => !!r.matchesSynopsis(query) || !!r.matchesTitle(query))
			}
		}

		if(filter){
			const { certificate, format, genre, country, picture } = filter;

			if(certificate) {
				filters.push(r => r.certificate === certificate);
			}

			if(format) {
				filters.push(r => r.format.includes(format));
			}

			if(genre) {
				filters.push(r => r.genre.includes(genre));
			}

			if(country) {
				filters.push(r => r.hasCountry(country));
			}


			if(picture) {
				filters.push(r => r.hasPictureType(picture));
			}
		}

		const records = rows.filter(r => filters.every(f=>f(r)));

		switch(sort?.by) {
			case 'title':
				records.sort((a, b) => a.compareTitle(b, sort.desc));
				break;
			case 'certificate':
				records.sort((a, b) => a.compareCertificate(b, sort.desc));
				break;
			case 'duration':
				records.sort((a, b) => a.compareDuration(b, sort.desc));
				break;
			case 'year':
				records.sort((a, b) => a.compareYear(b, sort.desc));
				break;
		}

		return records;
	}
}

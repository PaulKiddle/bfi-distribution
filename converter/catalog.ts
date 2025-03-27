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
	warnings: Warning[]
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

	const toRegex = (term: string|RegExp, flags = 'i') => typeof term === 'string' ? new RegExp(RegExp_escape(term), flags) : term;

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

		matchesSynopsis(string: string|RegExp){
			const matcher = toRegex(string, 'i')
			return this.synopsis.some(s=>s.match(matcher))
		}

		matchesTitle(string: string|RegExp){
			const matcher = toRegex(string, 'i')
			return !!this.title.match(matcher) || !!this.#sortTitle.match(matcher) || !!this.originalTitle?.match(matcher)
		}

		matchesPerson(string: string|RegExp){
			const matcher = toRegex(string, 'i');
			
			return !!String(this.cast??'').match(matcher) || !!this.directors?.match(matcher)
				|| [...this.#cast??[], ...this.#directors??[]].some(p => p.match(matcher));
		}

		hasCountry(c: string) {
			return this.#countries.includes(c);
		}

		hasPictureType(p: string) {
			return this.#pictures.includes(p);
		}
	}


export default class Catalog {
	date
	records
	warnings

	constructor(catalog: CatalogSource) {
		this.date = catalog.date;
		this.records = catalog.records.map(r => new Entry(r));
		this.warnings = catalog.warnings;
	}
}

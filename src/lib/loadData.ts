import showTimesRaw from '../../show_times.json';
import showsMetaRaw from '../data/shows_meta.json';
import venuesRaw from '../data/venues.json';
import type { ShowsMetaFile, ShowTimesFile, VenuesFile } from './types';
import { transform } from './transform';

const showTimes = showTimesRaw as ShowTimesFile;
const showsMeta = showsMetaRaw as ShowsMetaFile;
const venues = venuesRaw as VenuesFile;

export const { shows, days } = transform(showTimes, showsMeta, venues);

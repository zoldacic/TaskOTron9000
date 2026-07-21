export type Lang = 'en' | 'sv';

/** Values interpolated into a translation string via {name}-style placeholders. */
export type TParams = Record<string, string | number>;

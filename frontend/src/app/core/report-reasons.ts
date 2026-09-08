/**
 * Report categories offered by the report dialog.
 *
 * A fixed presentation list, not backend data: the API stores whatever reason
 * string the member submits, so these never need fetching.
 */
export const REPORT_REASONS: string[] = [
  'Spam or misleading',
  'Nudity or sexual content',
  'Harassment or hate speech',
  'Copyright — this is my photo',
  'Violence or dangerous acts',
  'Something else',
];

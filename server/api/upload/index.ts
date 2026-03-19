// Nitro's catch-all [...tus].ts does not match the base path /api/upload/.
// The tus protocol POSTs to the base URL for upload creation, so re-export
// the same handler here.
export { default } from './[...tus]'

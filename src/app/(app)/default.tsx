import { notFound } from 'next/navigation';

// `children` fallback for URLs with no matching page: show the 404 page
// instead of an empty shell.
export default function Default() {
  notFound();
}

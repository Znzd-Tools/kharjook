import { cookies } from 'next/headers';
import { FLAG_COOKIE, parseFlags, type FlagName, type FlagState } from './flags';

export async function getFlags(): Promise<FlagState> {
  const store = await cookies();
  return parseFlags(store.get(FLAG_COOKIE)?.value);
}

export async function isOn(flag: FlagName): Promise<boolean> {
  return (await getFlags())[flag];
}

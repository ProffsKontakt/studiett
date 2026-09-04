export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Saknar ${name} i .env.local`);
  return v;
}

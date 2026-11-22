// e2e only (loaded with NODE_OPTIONS=--require): shift the Node clock so it
// starts at process.env.E2E_NOW and keeps ticking. See e2e/now.ts.
const target = Date.parse(process.env.E2E_NOW || '');
if (!Number.isNaN(target)) {
  const RealDate = Date;
  const realNow = RealDate.now.bind(RealDate);
  const offset = target - realNow();
  RealDate.now = () => realNow() + offset;
  // A Proxy keeps every static (parse, UTC …), the prototype and instanceof.
  globalThis.Date = new Proxy(RealDate, {
    construct(t, args, newTarget) {
      return args.length === 0 ? Reflect.construct(t, [RealDate.now()], newTarget) : Reflect.construct(t, args, newTarget);
    },
    apply(t) {
      return new t(RealDate.now()).toString();
    },
  });
}

// Unit: vault/admit.mjs — the intake trust model. Budget is receiver-authority scaled by signer trust; the
// manifest's declared size is only ever compared against it, never trusted for it; and admission ≠ execution
// (an anonymous whale is admitted inert-and-marked, with no path to code). Run: node vault/admit.test.mjs
import { admit, budgetFor, disposition, DEFAULT_BUDGETS } from "./admit.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// budget scales with trust, and trust is about the SIGNER, not the payload
ok(budgetFor({ trusted: true }) === DEFAULT_BUDGETS.trusted, "a trusted signer gets the generous default budget");
ok(budgetFor({ trusted: false }) === DEFAULT_BUDGETS.anonymous, "an unknown signer gets the minimal budget");
ok(DEFAULT_BUDGETS.anonymous < DEFAULT_BUDGETS.trusted, "anonymous budget is strictly smaller than trusted");

// admission: declared ≤ granted, and defensive about a missing/invalid declaration or budget
ok(admit({ declaredTotal: 100, budget: 200 }).ok === true, "a whale within budget is admitted");
ok(admit({ declaredTotal: 300, budget: 200 }).ok === false, "a whale over budget is refused");
ok(admit({ declaredTotal: 200, budget: 200 }).ok === true, "exactly at budget is admitted");
ok(admit({ budget: 200 }).ok === false, "a missing declared size is refused");
ok(admit({ declaredTotal: -1, budget: 200 }).ok === false, "a negative declared size is refused");
ok(admit({ declaredTotal: 100 }).ok === false, "no granted budget is refused");

// the manifest never sets the budget: a huge declared size cannot lift its own ceiling
{
  const anon = budgetFor({ trusted: false });
  ok(admit({ declaredTotal: anon + 1, budget: anon }).ok === false, "an anonymous whale just over the minimal budget is refused");
  // ...until the crown grants an explicit, larger budget (the receiver's decision, not the manifest's)
  ok(admit({ declaredTotal: anon + 1, budget: anon * 100 }).ok === true, "an explicit larger crown grant admits it");
}

// disposition: admission is not execution — the byte/execution boundary
ok(disposition({ trusted: true }).mark === "trusted" && disposition({ trusted: true }).mayExecute === true, "trusted signer: marked trusted, may reach the code door");
{
  const d = disposition({ trusted: false });
  ok(d.mark === "anonymous" && d.mayExecute === false, "anonymous whale: admitted inert-and-marked, never executes");
}

console.log(`\n${fails ? "FAILED" : "all"} admit tests${fails ? "" : " passed"}`);
if (fails) process.exit(1);

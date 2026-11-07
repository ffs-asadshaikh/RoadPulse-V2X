<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Road simulation is calibrated from the PVS dataset: real per-drive stats live in `src/lib/pvs.ts` and the PVS 1 GPS trace in `src/lib/pvs-trace.json`; scoring formulas stay in `src/lib/v2x.ts`. Why: keeps real data, assumptions and the paper's formulas separable and testable.

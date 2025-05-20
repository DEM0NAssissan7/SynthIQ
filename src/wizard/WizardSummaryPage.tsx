/** We show the user their current sugar curves compared to what we predict it to be. This will include glucose shots, too.
 *
 */

import Graph from "../components/Graph";

export default function WizardSummaryPage() {
  return (
    <>
      <Graph series={[]}></Graph>
    </>
  );
}

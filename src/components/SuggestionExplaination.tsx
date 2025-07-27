type SuggestionExplainationProps = {
  amountSuggestion: number;
  timingSuggestion: number;
};
export default function ({
  amountSuggestion,
  timingSuggestion,
}: SuggestionExplainationProps) {
  // Decode signals
  const tooMuchInsulin = amountSuggestion > 0;
  const tooLittleInsulin = amountSuggestion < 0;
  const tooEarly = timingSuggestion < 0;
  const tooLate = timingSuggestion > 0;

  return (
    <>
      {tooMuchInsulin && "Your previous doses appear to have been too high"}
      {tooLittleInsulin && "Your previous doses may have been too low"}
      <br />
      {tooEarly && "Your insulin timing might have been too early"}
      {tooLate && "Your insulin timing might have been too late"}
    </>
  );
}

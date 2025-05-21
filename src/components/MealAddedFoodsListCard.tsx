import { useWizardMealState } from "../state/useWizardMeal";
import AddedFoodsDisplay from "./AddedFoodsDisplay";

export default function MealAddedFoodsListCard() {
  const { addedFoods, removeFood, changeFoodAmount } = useWizardMealState();

  return (
    <div className="card mb-4">
      <div className="card-body">
        <AddedFoodsDisplay
          foods={addedFoods}
          removeFood={removeFood}
          changeFoodAmount={changeFoodAmount}
        />
      </div>
    </div>
  );
}

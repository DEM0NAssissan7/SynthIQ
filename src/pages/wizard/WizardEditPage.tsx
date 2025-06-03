import AddedFoodsDisplay from "../../components/AddedFoodsDisplay";
import FoodSearchDisplay from "../../components/FoodSearchDisplay";
import { useWizardMeal } from "../../state/useMeal";

export default function WizardEditPage() {
  const meal = useWizardMeal();
  return (
    <>
      <h1>Edit Meal</h1>
      <FoodSearchDisplay meal={meal} />

      <AddedFoodsDisplay meal={meal} />
    </>
  );
}

import { useState, useMemo, useEffect, useRef } from "react";
import { Button, Form, ListGroup } from "react-bootstrap";
import { Food, foods } from "../lib/food";
import FoodDisplay from "../components/FoodDisplay";
import WizardManager, {
  WizardState,
  wizardStorage,
} from "../lib/wizardManager";
import type Meal from "../models/meal";
import {
  getCorrectionInsulin,
  getInsulin,
  getOptimalInsulinTiming,
} from "../lib/metabolism";
import { getPrettyTimeDiff, round } from "../lib/util";
import NightscoutManager from "../lib/nightscoutManager";
import MealGraph from "../components/MealGraph";
import Unit from "../models/unit";

export default function WizardMealPage() {
  const meal: Meal = wizardStorage.get("meal");

  // Query
  const [query, setQuery] = useState("");
  const filteredFoods = useMemo(() => {
    if (query.length === 0) return [];
    let result: Food[] = [];
    for (let f of foods) {
      if (meal.hasFood(f)) continue; // Prevent showing foods already added to meal
      if (f.name.toLowerCase().includes(query.trim().toLowerCase()))
        result.push(f);
    }
    return result;
  }, [query]);

  // Meal State
  function updateMeal() {
    meal.notify();
    // wizardStorage.write("meal");
  }

  // Foods Management
  const [addedFoods, setAddedFoods] = useState<Food[]>([]);
  useEffect(() => {
    const addedFoodsHandler = () => {
      setAddedFoods(meal.foods.slice(2));
    };

    meal.subscribe(addedFoodsHandler);

    return () => {
      meal.unsubscribe(addedFoodsHandler);
    };
  }, []);
  function addFood(food: Food, amount: number) {
    food.amount = amount;
    meal.addFood(food);
    setQuery("");
  }
  function removeFood(food: Food) {
    food.amount = 0;
    meal.removeFood(food);
  }

  // Meal Nutrition
  const [[mealCarbs, mealProtein], setNutrition] = useState([0, 0]);
  useEffect(() => {
    const nutritionHandler = () => {
      setNutrition([meal.getCarbs(), meal.getProtein()]);
    };

    meal.subscribe(nutritionHandler);
    return () => {
      meal.unsubscribe(nutritionHandler);
    };
  }, []);

  // Insulin
  const [[insulinNeed, insulinCorrection], setInsulin] = useState([0, 0]);
  const [insulinTime, setInsulinTime] = useState(new Date());

  useEffect(() => {
    let executing = false;
    const insulinNeedHandler = () => {
      if (!executing) {
        executing = true;
        let insulin = getTotalInsulin();
        console.log(
          insulin,
          meal.getCarbs(),
          meal.getProtein(),
          meal.initialGlucose,
          currentGlucose
        );
        setInsulin([insulin, getInsulinCorrection()]);
        meal.insulins = [];
        const optimalInsulinTimestamp = getOptimalInsulinTiming(
          meal,
          insulin,
          -2,
          6
        );
        meal.insulin(optimalInsulinTimestamp, insulin);
        setInsulinTime(optimalInsulinTimestamp);
        executing = false;
      }
    };
    meal.subscribe(insulinNeedHandler);

    return () => {
      meal.unsubscribe(insulinNeedHandler);
    };
  }, []);
  function getTotalInsulin() {
    return getMealInsulin() + getInsulinCorrection();
  }
  function getMealInsulin() {
    return getInsulin(meal.getCarbs(), meal.getProtein());
  }
  function getInsulinCorrection() {
    return getCorrectionInsulin(meal.initialGlucose);
  }

  // Current Glucose
  const [currentGlucose, setCurrentGlucose] = useState<any>(0);
  useEffect(() => {
    const currentGlucoseHandler = () => {
      setCurrentGlucose(meal.initialGlucose);
    };

    meal.subscribe(currentGlucoseHandler);

    return () => {
      meal.unsubscribe(currentGlucoseHandler);
    };
  }, []);
  function pullCurrentGlucose() {
    NightscoutManager.getCurrentSugar().then((g) => {
      meal.setInitialGlucose(g);
      setCurrentGlucose(g);
    });
  }

  // Additional Nutrients
  const [extraCarbs, setExtraCarbs] = useState(0);
  const [extraProtein, setExtraProtein] = useState(0);
  useEffect(() => {
    const extraNutrientsHandler = () => {
      setExtraCarbs(meal.getCarbsOffset());
      setExtraProtein(meal.getProteinOffset());
    };

    meal.subscribe(extraNutrientsHandler);
    return () => {
      meal.unsubscribe(extraNutrientsHandler);
    };
  }, []);

  // General Startup Tasks
  useEffect(() => {
    // Set meal timestamp to now upon page start
    meal.setTimestamp(new Date());

    // Pull intial glucose upon page start
    pullCurrentGlucose();

    // Set wizard state to meal page
    WizardManager.setState(WizardState.Meal);
  }, []);

  return (
    <>
      <h1 className="mb-3">Meal Creation</h1>
      <div className="card mb-4" id="food-adder">
        <div className="card-body">
          <Form>
            <Form.Group controlId="food-search" className="mb-3">
              <Form.Label>Food Search</Form.Label>
              <div className="input-group">
                <span className="input-group-text">
                  <i className="bi bi-search"></i>{" "}
                </span>
                <Form.Control
                  type="text"
                  placeholder="Search any food..."
                  value={query} // controlled value
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </Form.Group>
          </Form>

          <ListGroup>
            {filteredFoods.map((food) => (
              <FoodDisplay
                food={food}
                added={false}
                onButtonPressed={(amount: number) => {
                  addFood(food, amount);
                }}
              />
            ))}

            {filteredFoods.length === 0 && query.length !== 0 && (
              <ListGroup.Item className="text-muted">No matches</ListGroup.Item>
            )}
          </ListGroup>
        </div>
      </div>
      <div className="card mb-4" id="foods-summary">
        <div className="card-body">
          <ListGroup>
            <Form.Label>Foods</Form.Label>
            {addedFoods.map((food) => (
              <FoodDisplay
                food={food}
                added={true}
                onButtonPressed={() => {
                  removeFood(food);
                }}
                amount={food.amount}
                onAmountChanged={updateMeal}
              />
            ))}
            {addedFoods.length === 0 && (
              <ListGroup.Item className="text-muted">
                No foods added. Use the search box above to search for foods
                you're going to eat.
              </ListGroup.Item>
            )}
          </ListGroup>
        </div>
      </div>
      <div className="card mb-4" id="meal-summary">
        <div className="card-body">
          <Form.Label>Additional Nutrition</Form.Label>
          <ListGroup>
            <ListGroup.Item>
              <Form.Group controlId="carbs-offset" className="mb-3">
                <Form.Label className="text-muted">Carbs</Form.Label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-cookie"></i>
                  </span>
                  <Form.Control
                    type="number"
                    value={extraCarbs} // controlled value
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        meal.setCarbsOffset(value);
                        setExtraCarbs(value);
                      } else {
                        meal.setCarbsOffset(0);
                        setExtraCarbs(value);
                      }
                    }}
                  />
                </div>
              </Form.Group>
            </ListGroup.Item>
            <ListGroup.Item>
              <Form.Group controlId="protein-offset" className="mb-3">
                <Form.Label className="text-muted">Protein</Form.Label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-egg-fried"></i>
                  </span>
                  <Form.Control
                    type="number"
                    value={extraProtein} // controlled value
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        meal.setProteinOffset(value);
                        setExtraProtein(value);
                      } else {
                        meal.setProteinOffset(0);
                        setExtraProtein(value);
                      }
                    }}
                  />
                </div>
              </Form.Group>
            </ListGroup.Item>
          </ListGroup>
        </div>
      </div>
      <div className="card mb-4" id="meal-summary">
        <div className="card-body">
          <Form.Label>Summary</Form.Label>
          <ListGroup>
            <ListGroup.Item>
              {round(mealCarbs, 2)}g carbs<br></br>
              {round(mealProtein, 2)}g protein<br></br>
              <b>{round(insulinNeed, 2)}u insulin</b> (
              {round(insulinCorrection, 2)}u correction)
            </ListGroup.Item>
            <ListGroup.Item>
              Take <b>{round(insulinNeed, 2)}u</b> of insulin{" "}
              <b>
                {getPrettyTimeDiff(new Date(), insulinTime, Unit.Time.Minute)}
              </b>{" "}
              {mealCarbs !== 0 && mealProtein !== 0 && "you start eating"}
            </ListGroup.Item>
            <ListGroup.Item>
              <Form.Group controlId="current-glucose" className="mb-3">
                <Form.Label className="text-muted">
                  Current Blood Sugar
                </Form.Label>
                <div className="input-group">
                  <Button variant="primary" onClick={pullCurrentGlucose}>
                    Auto
                  </Button>
                  <span className="input-group-text">
                    <i className="bi bi-droplet"></i>
                  </span>
                  <Form.Control
                    type="number"
                    value={currentGlucose} // controlled value
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        setCurrentGlucose(value);
                        meal.setInitialGlucose(value);
                      } else {
                        setCurrentGlucose("");
                      }
                    }}
                  />
                </div>
              </Form.Group>
            </ListGroup.Item>
          </ListGroup>
        </div>
      </div>
      <div className="card mb-4" id="meal-summary">
        <div className="card-body">
          <Form.Label>Predicted Blood Sugar</Form.Label>
          <MealGraph meal={meal} from={-1} until={16} width="100%"></MealGraph>
        </div>
      </div>
    </>
  );
}

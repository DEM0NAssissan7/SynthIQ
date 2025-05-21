import { useState, useMemo, useEffect } from "react";
import { Button, Form, ListGroup } from "react-bootstrap";
import WizardManager from "../lib/wizardManager";
import type Meal from "../models/meal";
import {
  getCorrectionInsulin,
  getInsulin,
  getOptimalInsulinTiming,
} from "../lib/metabolism";
import {
  convertDimensions,
  getEpochMinutes,
  getHourDiff,
  getPrettyTimeDiff,
  round,
} from "../lib/util";
import NightscoutManager from "../lib/nightscoutManager";
import MealGraph from "../components/MealGraph";
import Unit from "../models/unit";
import { useNavigate } from "react-router";
import { wizardStorage } from "../storage/wizardStore";
import Food, { foods } from "../models/food";
import { WizardState } from "../models/wizardState";

export default function WizardMealPageOld() {
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
    const newFood = new Food(
      food.name,
      food.carbsRate,
      food.proteinRate,
      food.unit,
      food.GI
    );
    newFood.amount = amount;
    meal.addFood(newFood);
    setQuery("");
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
      if (!executing && !WizardManager.getInsulinMarked()) {
        executing = true;
        let insulin = getTotalInsulin();
        // console.log(
        //   insulin,
        //   meal.getCarbs(),
        //   meal.getProtein(),
        //   meal.initialGlucose,
        //   currentGlucose
        // );
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
  function getNInsulin(): number {
    return getHourDiff(insulinTime, new Date());
  }
  function getTakeInsulinVariant(): string {
    if (getNInsulin() >= 0) return "primary";
    return "secondary";
  }
  function getBeginEatingVariant(): string {
    if (getNInsulin() < 0 || WizardManager.getInsulinMarked()) return "primary";
    return "secondary";
  }

  // Eat times (if insulin already taken)
  const [[relativeEatTime, insulinTakenTime], setRelativeTimes] = useState([
    0, 0,
  ]);
  function getRelativeEatTime(): number {
    console.log(getOptimalInsulinTiming(meal, meal.getInsulin(), -2, 6));
    return (
      getEpochMinutes(new Date()) -
      getEpochMinutes(getOptimalInsulinTiming(meal, meal.getInsulin(), -2, 6))
    );
  }
  function getInsulinTime(): number {
    return round(
      Math.abs(
        getEpochMinutes(new Date()) -
          getEpochMinutes(meal.insulins[0].timestamp)
      ),
      0
    );
  }
  useEffect(() => {
    if (WizardManager.getInsulinMarked()) {
      const handler = () => {
        setRelativeTimes([getRelativeEatTime(), getInsulinTime()]);
      };
      const intervalID = setInterval(
        handler,
        convertDimensions(Unit.Time.Hour, Unit.Time.Millis)
      );
      handler();
      meal.subscribe(handler);
      return () => {
        clearInterval(intervalID);
        meal.unsubscribe(handler);
      };
    }
  }, []);

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
    if (!WizardManager.getMealMarked()) {
      meal.setTimestamp(new Date());
      // Pull intial glucose upon page start
      pullCurrentGlucose();
    } else {
      /** If the meal has already been marked (i.e. user already ate),
       * we redirect to the proper page depending on whether the insulin has been marked or not */
      if (WizardManager.getInsulinMarked())
        WizardManager.moveToPage(WizardState.Summary, navigate);
      else WizardManager.moveToPage(WizardState.Insulin, navigate);
    }

    // Set wizard state to meal page
    // WizardManager.setState(WizardState.Meal, navigate);
  }, []);

  // Wizard
  const navigate = useNavigate();
  function beginEating() {
    if (confirm("Are you ready to start eating?")) {
      WizardManager.markMeal();
      if (WizardManager.getInsulinMarked()) {
        WizardManager.moveToPage(WizardState.Summary, navigate);
      } else {
        WizardManager.moveToPage(WizardState.Insulin, navigate); // Move onto taking insulin
      }
    }
  }
  function takeInsulin() {
    WizardManager.moveToPage(WizardState.Insulin, navigate);
  }

  return (
    <>
      <h1 className="mb-3">Meal Creation</h1>
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
                  <span className="input-group-text">g</span>
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
                  <span className="input-group-text">g</span>
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
              {WizardManager.getInsulinMarked() ? (
                <>
                  <b>{round(meal.getInsulin(), 2)}u</b> insulin (
                  {insulinTakenTime} minutes ago)
                </>
              ) : (
                <>
                  <b>{round(insulinNeed, 2)}u insulin</b>{" "}
                  {(mealCarbs !== 0 || mealProtein !== 0) && (
                    <>{round(insulinCorrection, 2)}u correction)</>
                  )}
                </>
              )}
            </ListGroup.Item>
            {(relativeEatTime >= 0 || !WizardManager.getInsulinMarked()) && (
              <ListGroup.Item>
                {WizardManager.getInsulinMarked() ? (
                  <>
                    Consider eating in <b>{relativeEatTime} minutes</b>
                  </>
                ) : (
                  <>
                    Consider taking <b>{round(insulinNeed, 2)}u</b> of insulin
                    {(mealCarbs !== 0 || mealProtein !== 0) && (
                      <>
                        {" "}
                        <b>
                          {getPrettyTimeDiff(
                            new Date(),
                            insulinTime,
                            Unit.Time.Minute
                          )}
                        </b>{" "}
                        you start eating
                      </>
                    )}
                  </>
                )}
              </ListGroup.Item>
            )}
            {!WizardManager.getInsulinMarked() && (
              <ListGroup.Item>
                <Form.Group controlId="current-glucose" className="mb-3">
                  <Form.Label className="text-muted">
                    Current Blood Sugar
                  </Form.Label>
                  <div className="input-group">
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
                    <Button variant="primary" onClick={pullCurrentGlucose}>
                      Auto
                    </Button>
                  </div>
                </Form.Group>
              </ListGroup.Item>
            )}
            <ListGroup.Item></ListGroup.Item>
          </ListGroup>
        </div>
      </div>
      <div className="card mb-4" id="meal-summary">
        <div className="card-body">
          <Form.Label>
            Predicted Blood Sugar{" "}
            {WizardManager.getInsulinMarked() && "(if you eat now)"}
          </Form.Label>
          <MealGraph meal={meal} from={-1} until={16} width="100%"></MealGraph>
        </div>
      </div>
      <div className="d-flex justify-content-end">
        {!WizardManager.getInsulinMarked() && (
          <>
            <Button
              variant={getTakeInsulinVariant()}
              onClick={takeInsulin}
              className="me-2"
            >
              Take Insulin
            </Button>
          </>
        )}
        <Button variant={getBeginEatingVariant()} onClick={beginEating}>
          Begin Eating
        </Button>
      </div>
    </>
  );
}

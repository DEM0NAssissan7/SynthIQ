/* This is where we store custom meals, foods, etc. */
import Serialization from "../lib/serialization";
import StorageNode from "./storageNode";
import Food, { foods as globalFoods } from "../models/food";

export namespace CustomStore {
  const node = new StorageNode("custom");

  export const foods = node.add<Food[]>(
    "foods",
    [],
    Serialization.getArraySerializer(Food.serialize),
    Serialization.getArrayDeserializer(Food.deserialize)
  );
  // Push custom foods to global when loaded or updated
  foods.subscribe((customFoods: Food[]) => {
    if (Array.isArray(customFoods)) {
      customFoods.forEach((food) => {
        if (!globalFoods.some((f) => f.name === food.name)) {
          globalFoods.push(food);
        }
      });
    }
  });

  export function addFood(food: Food) {
    let current: Food[] = [];
    try {
      current = foods.value;
    } catch {
      // Storage not loaded yet
    }
    foods.value = [...current, food];

    if (!globalFoods.some((f) => f.name === food.name)) {
      globalFoods.push(food);
    }
  }

  export function removeFood(food: Food) {
    let current: Food[] = [];
    try {
      current = foods.value;
    } catch {
      // Storage not loaded yet
    }
    const newFoods = current.filter((f: Food) => f.name !== food.name && f !== food);
    foods.value = newFoods;

    const idx = globalFoods.findIndex((f: Food) => f.name === food.name || f === food);
    if (idx !== -1) {
      globalFoods.splice(idx, 1);
    }
  }
}

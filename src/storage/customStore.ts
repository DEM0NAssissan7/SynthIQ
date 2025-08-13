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
  // Push custom foods to global
  globalFoods.push(...foods.value);
  export function addFood(food: Food) {
    foods.value = [...foods.value, food];

    globalFoods.push(food);
  }
  export function removeFood(food: Food) {
    const newFoods = foods.value.filter((f: Food) => f !== food);
    foods.value = newFoods;

    globalFoods.filter((f: Food) => f !== food);
  }
}

import React from "react";
import Series from "../models/series";

class Graph extends React.Component {
  series: Series[] = [];
  max: number = 10;
  min: number = -10;

  addSeries() {}
  render() {
    return <h2>Hi, I am a Car!</h2>;
  }
}

export default Graph;

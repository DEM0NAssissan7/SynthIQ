function ListGroup() {
  const stuff = ["Hello", "This", "Is", "A", "Test!"];
  return (
    <>
      <h1>List Group</h1>
      <div id="list-example" className="list-group">
        {stuff.map((x) => (
          <a className="list-group-item list-group-item-action">{x}</a>
        ))}
      </div>
    </>
  );
}

export default ListGroup;

/*
1. neuron graphs without cycles are like classical neural networks
2. neuron graphs with cycles are like recurrent neural networks
3. mutation strategy
    - initially any new node or connection is equally likely but as each mutation once tried out is weighted less next time, this ensures time is not wasted in looking for already tried solutions 
    - mutating based on graph's output
    - mutating based on another graph's output
    - mutating in real time: each network has a lifetime at end of which it's score is calculated, new network is added to population when old one dies
        - instead each gene has a mutation timer, each gene is made up of smaller genes which mutate after this time, this mutation can be changing activation function or weight
    - discarding already tried mutations
        - lower probability of already tried mutations to occur again 
            - what about different weights?
            - weight agnostic neural networks?
                - all weights are either k, all weights are either + or - k , all weights are [-k, -k+1 , ... 0, 1, 2, 3 ... k]
                - stepwise weights evolution-
                    1. all weights new weights are either +1.0 or 0, or -1.0 ( bucketing around extremes )
                    2. all weights stable till last k1 generations are mutable and are prev weight +- 0.5
                    3. all weights stable till last k2 generations are mutable and are prev weight +- 0.25 ...
4. multiple crossover option
5. novelty search

checkpoints:
1. weight agnostic neuron graph for basic problems - linear, xor, circle, ellipsoid;

NEURON GRAPH:
    1. run a graph
    2. add node
    3. add connection
    4. disable connection
    5. update weight
    6. change activation
POPULATION:
use cases - 
    1. generate first generation
    2. simulation / run generation
    3. generate next generation
    4. run n generation
    5. mutation strategy
    6. crossover strategy
    
*/
/*
programs:
    1. next - calculate next activations from current activations and genome
    2. mutate - calculate next modifications from current genome
    3. cross - get child gene from parent gene
    4. modulate - calculate new weights from current weights
    5. addNode
    6. addConnection
    7. addRandomNode
    8. addRandomConnection


output = new activations and weights

*/

class Activation {
  constructor(fn, derivativeFn) {
    this.fn = fn;
    this.derivativeFn = derivativeFn;
  }
}
const activations = {
  sigmoid: new Activation((x) => 1 / (1 + Math.exp(-x))),
  relu: new Activation((x) => (x > 0 && x) || 0),
  leaking_relu: new Activation((x) => (x > 0 && x) || 0.1 * x),
};

class Connection {
  constructor(innovation, inpNode, weight, enabled) {
    this.inpNode = inpNode;
    this.weight = weight;
    this.innovation = innovation;
    this.enabled = enabled;
  }
}

class GraphNode {
  constructor(
    innovation,
    inpConnections = [],
    opConnections = [],
    activation = activations.leaking_relu,
    bias = 0,
    value = 0,
    activationValue = 0
  ) {
    this.inpConnections = inpConnections;
    this.opConnections = opConnections;
    this.activation = activation;
    this.innovation = innovation;
    this.bias = bias;
    this.value = value;
    this.activationValue = activationValue;
  }
}
class Graph {
  constructor(adjMat) {
    this.nodes = new Array(adjMat.length).fill(0).map((x, i) => {
      let node = new GraphNode(0);
      node.index = i;
      return node;
    });
    this.sourceNodes = [];
    for (let i in adjMat) {
      let inp = adjMat[i];
      for (let j in inp) {
        let w = inp[j];
        if (w) {
          this.nodes[i].inpConnections.push(
            new Connection(0, this.nodes[j], w, true)
          );
          this.nodes[j].opConnections.push(
            new Connection(0, this.nodes[i], w, true)
          );
        }
      }
      !this.nodes[i].inpConnections.length &&
        this.sourceNodes.push(this.nodes[i]);
    }
    this.sinkNodes = [];
    for (let node of this.nodes) {
      if (!node.opConnections.length) {
        this.sinkNodes.push(node);
      }
    }
    this.dfs();
  }
  activate(inp = []) {
    for (let i in this.sourceNodes) {
      let node = this.sourceNodes[i];
      node.activationValue = inp[i] || 0;
    }
    for (let node of this.nodes) {
      if (node.inpConnections.length) {
        let value = node.bias;
        for (let i in node.inpConnections) {
          let connection = node.inpConnections[i];
          connection.enabled &&
            (value += connection.inpNode.value * connection.weight);
        }
        value = node.activation.fn(value);
        node.activationValue = value;
      }
    }
    for (let node of this.nodes) {
      node.value = node.activationValue;
    }
  }
  logActivations() {
    console.log(this.nodes.map((x) => x.value).join(","));
  }
  dfs() {
    let curDepth = 0;
    let maxDepth = curDepth;
    for (let node of this.sourceNodes) {
      let nodeStack = [node];
      while (nodeStack.length) {
        let node = nodeStack[nodeStack.length - 1];
        console.log(node.index);
        if (node.stacked) {
          nodeStack.pop();
          node.stacked = false;
          curDepth--;
          continue;
        }
        curDepth++;
        node.stacked = true;
        node.depth = Math.max(curDepth, node.depth || 0);
        maxDepth < curDepth && (maxDepth = curDepth);
        for (let op of node.opConnections) {
          let node = op.inpNode;
          console.log("o", node.index);
          if (node.stacked) {
            for (let node of nodeStack) {
              node.stacked = false;
            }
            this.maxDepth = -1;
            return this;
          }
          nodeStack.push(node);
        }
      }
    }
    this.maxDepth = maxDepth;
    this.depthMap = new Array(this.maxDepth).fill(0).map(() => []);
    for (let node of this.nodes) {
      console.log(node.index, node.depth, "d");
      if (node.depth) {
        this.depthMap[node.depth - 1].push(node);
      }
    }
    return this;
  }
  staticActivate(inp = []) {
    for (let i in this.sourceNodes) {
      let node = this.sourceNodes[i];
      node.value = inp[i] || 0;
    }
    for (let i = 1; i < this.maxDepth; i++) {
      let nodes = this.depthMap[i];
      for (let node of nodes) {
        let value = node.bias;
        for (let connection of node.inpConnections) {
          connection.enabled &&
            (value += connection.inpNode.value * connection.weight);
        }
        value = node.activation.fn(value);
        node.value = value;
      }
    }
  }
}
// k8 scope , automated load tests for api benchmarking per service, load tests for max scale per service, load tests for total scale
// see mongo benchmarks
class Population {
  constructor(size, inpSize, opSize) {
    let nodesLen = inpSize + opSize;
    let adjMatrix = new Array(nodesLen);
    let i = 0;
    while (i < inpSize) {
      adjMatrix[i] = new Array(nodesLen).fill(0);
      i++;
    }
    while (i < nodesLen) {
      let row = new Array(nodesLen);
      for (let j = 0; j < nodesLen; j++) {
        row[j] = (j < inpSize && 1) || 0;
      }
      adjMatrix[i] = row;
      i++;
    }
    this.graphs = new Array(size).fill(0).map((x) => new Graph(adjMatrix));
  }
}

let x = new Graph([
  [0, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [1, 1, 1, 0],
]);
console.log(x.depthMap, x.maxDepth);
x.logActivations();
x.activate([1]);
x.logActivations();
x.activate([1]);
x.logActivations();
x.activate([2]);
x.logActivations();
x.activate([1]);
x.logActivations();
x.activate([1]);
x.logActivations();
x.activate([1]);
x.logActivations();
console.log("-");
x.staticActivate([1]);
x.logActivations();
x.staticActivate([1]);
x.logActivations();
x.staticActivate([2]);
x.logActivations();
x.staticActivate([1]);
x.logActivations();
x.staticActivate([1]);
x.logActivations();
x.staticActivate([1]);
x.logActivations();
// console.log(x);

// let y = new Graph([
//   [0, 0],
//   [1, 1],
// ]);
// console.log(y);
// y.logActivations();
// y.activate([1]);
// y.logActivations();
// y.activate([1]);
// y.logActivations();
// y.activate([1]);
// y.logActivations();
// y.activate([1]);
// y.logActivations();
// y.activate([1]);
// y.logActivations();
// y.activate([1]);
// y.logActivations();
// console.log(y);

// // let p = new Population(2, 2, 3);

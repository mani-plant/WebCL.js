function Counter(start = 0, step = 1) {
  this.next = function () {
    return (start += step);
  }
  this.read = function () {
    return start;
  }
}
function UniformRandomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}
function Activation(fx, dx) {
  this.fx = fx;
  this.dx = dx;
}
function randomIntWeighted(p) {
  let x = Math.random();
  let oddsSum = p[0] || 0;
  let i = 0;
  while (oddsSum < x) {
    oddsSum += p[i];
    i++;
    if (i >= p.length) {
      return 0;
    }
  }
  return i;
}
const Activations = {
  sigmoid: new Activation((x) => (1 / (1 + Math.exp(-4.9 * x)))),
  relu: new Activation((x) => (x > 0 && x) || 0),
  leaking_relu: new Activation((x) => (x > 0 && x) || 0.1 * x),
  identity: new Activation((x) => x),
  unity: new Activation((x) => 1),
  arctan: new Activation((x) => Math.atan(x)),
  tanh: new Activation((x) => Math.tanh(x)),
  fiftyfifty: new Activation((x) => {
    return x > 0 ? 0 : 1;
  })
};
const defaultHiddenActivation = Activations.sigmoid;
const defaultActivation = Activations.sigmoid;
const defaultInputActivation = Activations.identity;
const defaultOutputActivation = Activations.fiftyfifty;
const NodeTypes = {
  input: 0,
  hidden: 1,
  output: 2,
};
const ConnectionStatus = {
  disabled: 0,
  enabled: 1,
};
function NodeGene(type, activation = defaultActivation) {
  this.activation = activation;
  this.type = type;
  this.clone = function () {
    return new NodeGene(this.type, this.activation);
  }
}
function ConnectionGene(
  innovation,
  inp,
  op,
  weight,
  status = ConnectionStatus.enabled
) {
  this.innovation = innovation;
  this.inp = inp;
  this.op = op;
  this.weight = weight;
  this.status = status;
  this.clone = function () {
    return new ConnectionGene(this.innovation, this.inp, this.op, this.weight, this.status);
  }
}
function NeuronGraph() {
  let nodes = [];
  let connections = [];
  let inpConnections = [];
  let opConnections = [];
  let inpNodes = [];
  let opNodes = [];
  let nodesDepth = [];
  let activations = [];
  let addNode = function (type, activation) {
    let node = new NodeGene(type, activation)
    let i = nodes.push(node) - 1;
    activations.push(0);
    inpConnections.push([]);
    opConnections.push([]);
    if (node.type === NodeTypes.input) {
      inpNodes.push(i);
      nodesDepth.push(0);
    } else if (node.type === NodeTypes.output) {
      opNodes.push(i);
      nodesDepth.push(-1);
    } else {
      nodesDepth.push(-1);
    }
    return i;
  }
  let dfs = function (returnOnCycle = true, nodeStack = [...inpNodes], curDepth = 0, skipCondition, onProcess, onPop, onDone, onCycle) {
    let stacked = new Array(nodes.length).fill(false);
    while (nodeStack.length) {
      let node = nodeStack[nodeStack.length - 1];
      if (stacked[node]) {
        stacked[node] = false;
        nodeStack.pop();
        curDepth--;
        onPop && onPop(node, curDepth, nodeStack, stacked);
        continue;
      }
      stacked[node] = true;
      if (skipCondition(node, curDepth, nodeStack, stacked)) {
        continue;
      }
      onProcess && onProcess(node, curDepth, nodeStack, stacked);
      curDepth++;
      for (let connection of opConnections[node]) {
        if (connection.status === ConnectionStatus.enabled) {
          let opNode = connection.op;
          if (stacked[opNode]) {
            onCycle && onCycle(node, curDepth, nodeStack, stacked);
            if (returnOnCycle) {
              return onDone && onDone(true);
            }
            continue;
          }
          nodeStack.push(opNode);
        }
      }
    }
    return onDone && onDone(false);
  };
  let addConnection = function (innovation, inpNode, opNode, weight, status) {
    let connection = new ConnectionGene(innovation, inpNode, opNode, weight, status);
    let op = connection.op;
    let inp = connection.inp;
    if (!nodes[inp] || !nodes[op]) return false;
    if (nodes[op].type === NodeTypes.input) return false;
    for (let opc of inpConnections[op]) {
      let con = connections[opc];
      if (con.inp === inp) {
        if (con.status === ConnectionStatus.disabled) {
          con.status = ConnectionStatus.enabled;
          return true;
        }
        return false;
      }
    }
    let c = connections.push(connection) - 1;
    inpConnections[op].push(c);
    opConnections[inp].push(c);
    if (nodesDepth[inp] >= 0 && nodesDepth[op] <= nodesDepth[inp]) {
      let nodesDepthUpdates = [];
      return dfs(true, [op], nodesDepth[inp] + 1, function (node, curDepth) {
        return nodesDepth[node] >= curDepth;
      }, function (node, curDepth) {
        curDepth > nodesDepth[node] && (nodesDepthUpdates.push([node, curDepth]));
      }, null, function (fromCycle) {
        if (fromCycle) {
          inpConnections[op].pop();
          opConnections[inp].pop();
          connections.pop();
          return false;
        }
        // process node depth updates
        for (let operation of nodesDepthUpdates) {
          nodesDepth[operation[0]] = operation[1];
        }
        return c;
      },);
    }
    return c;
  }
  let disableConnection = function (connectionIndex) {
    let connection = connections[connectionIndex];
    if (connection.status !== ConnectionStatus.disabled) {
      connection.status = ConnectionStatus.disabled;
      let oldOpDepth = nodesDepth[connection.op];
      let oldInpDepth = nodesDepth[connection.op];
      if (oldInpDepth >= 0 && oldOpDepth === oldInpDepth + 1) {
        let inps = inpConnections[connection.op];
        let maxDepth = -1;
        let maxDepthNode = undefined;
        for (let c of inps) {
          let con = connections[c];
          if (con.status === ConnectionStatus.disabled) continue;
          let inpNode = con.inp;
          let thisInpDepth = nodesDepth[inpNode];
          if (thisInpDepth === oldInpDepth) {
            return true;
          }
          if (thisInpDepth > oldInpDepth) {
            throw new Error("Impossible depth detected!");
          }
          (maxDepth < thisInpDepth) && (maxDepthNode = inpNode);
          nodesDepth[connection.op] = -1;
          if (maxDepthNode) {
            let nodesDepthUpdates = [];
            return dfs(true, [connection.op], maxDepth, function (node, curDepth) {
              return nodesDepth[node] >= curDepth;
            }, function (node, curDepth) {
              curDepth > nodesDepth[node] && (nodesDepthUpdates.push([node, curDepth]));
            }, null, function (fromCycle) {
              if (fromCycle) {
                return false;
              }
              // process node depth updates
              for (let operation of nodesDepthUpdates) {
                nodesDepth[operation[0]] = operation[1];
              }
            });
          }
        }
      }
      return true;
    }
  }
  let activate = function (inp) {
    for (let i in inpNodes) {
      activations[inpNodes[i]] = inp[i];
    }
    let depthMap = [];
    for (let i in nodes) {
      let nodeDepth = nodesDepth[i];
      if (nodeDepth < 0) {
        continue;
      }
      while (!depthMap[nodeDepth]) {
        depthMap.push([]);
      }
      depthMap[nodeDepth].push(i);
    }
    for (let layer of depthMap) {
      for (let node of layer) {
        let nodeGene = nodes[node];
        if (
          nodeGene.type === NodeTypes.hidden ||
          nodeGene.type === NodeTypes.output
        ) {
          let activation = 0;
          for (let i of inpConnections[node]) {
            let inpConnection = connections[i];
            if (inpConnection.status === ConnectionStatus.enabled) {
              activation += inpConnection.weight * activations[inpConnection.inp];
            }
          }
          activations[node] = nodeGene.activation.fx(activation || 0);
        }
      }
    }
    let op = [];
    for (let i of opNodes) {
      op.push(activations[i]);
    }
    return op;
  };
  this.activate = activate;
  this.activations = activations;
  this.log = function () {
    console.log({ _this: this, nodes, connections, inpConnections, opConnections, inpNodes, opNodes, nodesDepth })
  }
  this.addNode = addNode;
  this.addConnection = addConnection;
  this.connections = connections;
  this.nodes = nodes;
  this.nodesDepth = nodesDepth;
  this.opNodes = opNodes;
  this.inpNodes = inpNodes;
  this.clone = function () {
    let clone = new NeuronGraph();
    for (let i in nodes) {
      let node = nodes[i];
      clone.addNode(node.type, node.activation);
    }
    let success = true;
    for (let i in connections) {
      let connection = connections[i];
      success = clone.addConnection(connection.innovation, connection.inp, connection.op, connection.weight, connection.status);
    }
    if (!success) {
      throw new Error("Cloning failed");
    }
    return clone;
  }
  this.score = 0;
}
// let x = new NeuronGraph();
// x.addNodes([new NodeGene(NodeTypes.input), new NodeGene(NodeTypes.input), new NodeGene(NodeTypes.hidden, Activations.relu), new NodeGene(NodeTypes.hidden, Activations.relu), new NodeGene(NodeTypes.output, Activations.identity), new NodeGene(NodeTypes.input)]);
// x.addConnections([new ConnectionGene(1, 0, 2, 1, ConnectionStatus.enabled),
// new ConnectionGene(2, 0, 3, 1, ConnectionStatus.enabled),
// new ConnectionGene(3, 1, 2, 1, ConnectionStatus.enabled),
// new ConnectionGene(4, 1, 3, 1, ConnectionStatus.enabled),
// new ConnectionGene(7, 5, 4, 1, ConnectionStatus.enabled),
// new ConnectionGene(5, 3, 4, 1, ConnectionStatus.enabled),
// new ConnectionGene(6, 2, 4, 1, ConnectionStatus.enabled)]);


// let y = new NeuronGraph();
// y.addNode(NodeTypes.input);
// y.addNode(NodeTypes.input);
// y.addNode(NodeTypes.output);
// y.addConnection(1, 0, 2, 1);
// y.addConnection(2, 1, 2, 1);
// y.log();
// // y.activate([1,2]);
// // y.log();
// // y.addNode(new NodeGene(NodeTypes.hidden));
// y.addConnection(3, 0, 3, 1);
// y.addConnection(4, 3, 2, 1);
// y.log();
// y.activate([1, 2]);

function Population(populationSize, inpDim, opDim) {
  let innovation = new Counter();
  let population = [];
  let generation = new Counter();
  let trackedMutations = {};
  function getTrackedInnovation(inp, op) {
    let gm = trackedMutations[generation.read()] || (trackedMutations[generation.read()] = {});
    let tm = gm[inp] || (gm[inp] = {});
    return tm[op] || (tm[op] = innovation.next());
  }
  function evalError(op, t) {
    let err = 0;
    for (let i in t) {
      let e = (t[i] - op[i]);
      err += e * e;
    }
    return err;
  }
  function newIndividual() {
    let individual = new NeuronGraph();
    for (let i = 0; i < inpDim; i++) {
      individual.addNode(NodeTypes.input, defaultInputActivation);
    }
    for (let i = 0; i < opDim; i++) {
      individual.addNode(NodeTypes.output, defaultOutputActivation);
    }
    let len = inpDim + opDim;
    for (let i = 0; i < inpDim; i++) {
      for (let j = inpDim; j < len; j++) {
        individual.addConnection(getTrackedInnovation(i, j), i, j, 1, ConnectionStatus.enabled);
      }
    }
    return individual;
  }

  function addNodeAtConnection(individual, connectionIndex, type, activation) {
    let connection = individual.connections[connectionIndex];
    let inp = connection.inp;
    let op = connection.op;
    if (connection.status !== ConnectionStatus.enabled) {
      return false;
    }
    connection.status = ConnectionStatus.disabled;
    let n = individual.addNode(type, activation);
    individual.addConnection(getTrackedInnovation(inp, n), inp, n, 1, ConnectionStatus.enabled);
    individual.addConnection(getTrackedInnovation(n, op), n, op, connection.weight, ConnectionStatus.enabled);
    // console.log("addNodeAtConnection", n);
    return n;
  }
  function addConnection(individual, inp, op, weight, status) {
    let c = individual.addConnection(getTrackedInnovation(inp, op), inp, op, weight, status);
    // console.log("addConnection", c);
    return c;
  }

  let c1 = 1;
  let c2 = 1;
  let c3 = 0.4;
  let specie_threshold = 0.6;
  function distance(individual1, individual2) {
    /*
      of the number of excess E and disjoint D genes, as well as the , including disabled genes:

      W = average weight differences of matching genes
      E = excess genes
      D = disjoint genes
      δ = c1.E/N + c2.D/N + c3.W
      N = size of genome
      adjusted fitness = fitness / number of organisms in the same species

      Every species is assigned a potentially different number of offspring in proportion to the sum of adjusted fitnesses of its member organisms.

    */
    /*
    c1 (i1) ... .   (in) | d1 d2
    .................... | 
    */
    let con1 = individual1.connections;
    let con2 = individual2.connections;
    let excess = 0;
    let disjoint = 0;
    let matching = 0;
    let matchingSum = 0;
    let i = 0, j = 0;
    while (i < con1.length && j < con2.length) {
      let c1 = con1[i];
      let c2 = con2[j];
      if (c1.innovation < c2.innovation) {
        i++;
        disjoint++;
      } else if (c1.innovation > c2.innovation) {
        j++;
        disjoint++;
      } else {
        matching++;
        matchingSum += Math.abs(c1.weight - c2.weight);
        i++;
        j++;
        continue;
      }
    }
    let len = Math.max(con1.length, con2.length);
    if (i < con1.length) {
      excess = con1.length - i;
    }
    if (j < con2.length) {
      excess = con2.length - j;
    }
    let N = len;
    return ((c1 * excess / N) + (c2 * disjoint / N) + ((c3 * matchingSum) / (matching || 1)));
  }
  function evaluateIndividual(individual, inps, ops) {
    let score = 0;
    for (let i = 0; i < inps.length; i++) {
      score += evalError(individual.activate(inps[i]), ops[i]);
    }
    score = (inps.length - score) / inps.length;
    individual.score = score;
    return score;
  }
  for (let i = 0; i < populationSize; i++) {
    population.push(newIndividual());
  }
  this.activate = function (inp) {
    return population.map(x => x.activate(inp));
  }
  function evaluate(inps, ops) {
    return population.map(individual => evaluateIndividual(individual, inps, ops));
  }

  let mutation_only_offSprings = 25;
  let new_node_rate = 3;
  let new_connection_rate = 5;
  let weight_mutation_rate = 8;
  let weight_zero_rate = 1;
  let weight_pertubation_rate = 71;
  let elitism_threshold = 1;
  function mutation(individual) {
    // console.log("mutation");
    let r = Math.random() * 100;
    let clone = individual.clone();
    if (r < new_node_rate) {
      // console.log("new node");
      addNodeAtConnection(clone, UniformRandomInt(0, clone.connections.length), NodeTypes.hidden, defaultHiddenActivation);
      return clone;
    }
    if (r < new_connection_rate + new_node_rate) {
      // console.log("new connection");
      let inp = UniformRandomInt(0, clone.nodes.length);
      let op = UniformRandomInt(0, clone.nodes.length);
      addConnection(clone, inp, op, (2 * Math.random()) - 1, ConnectionStatus.enabled);
      return clone;
    }
    if (r < new_connection_rate + new_node_rate + weight_mutation_rate) {
      // console.log("new weight");
      clone.connections[UniformRandomInt(0, clone.connections.length)].weight = (2 * Math.random()) - 1;
      return clone;
    }
    if (r < new_connection_rate + new_node_rate + weight_mutation_rate + weight_zero_rate) {
      // console.log("new weight");
      clone.connections[UniformRandomInt(0, clone.connections.length)].weight = 0;
      return clone;
    }
    if (r < new_connection_rate + new_node_rate + weight_mutation_rate + weight_zero_rate + weight_pertubation_rate) {
      clone.connections[UniformRandomInt(0, clone.connections.length)].weight += (Math.random()*0.2 - 0.1);
      return clone;
    }
    return clone;
  }
  function cross(individual1, individual2) {
    // console.log("cross");
    let m1 = individual1.clone()
    let m2 = individual2.clone();
    for (let i = 0; i < m1.connections.length && i < m2.connections.length; i++) {
      let c1 = m1.connections[i];
      let c2 = m2.connections[i];
      if (c1.innovation === c2.innovation) {
        if (c1.inp !== c2.inp && c1.op !== c2.op) {
          throw new Error("Invalid innvoation number found");
        }
        if (c1.status === ConnectionStatus.enabled && c2.status === ConnectionStatus.enabled) {
          c1.weight = (Math.random() * 2 - 1 > 0) ? c1.weight : c2.weight;
          c2.weight = (Math.random() * 2 - 1 > 0) ? c2.weight : c1.weight;
        }
      }
    }
    return [m1];
  }
  function nextGen(parents, size, odds) {
    let oddsSum = 0;
    odds.forEach(x => oddsSum += x);
    let p = odds.map(x => x/oddsSum);
    let mutationOnlyOffspringCount = Math.round(size * mutation_only_offSprings / 100);
    let offspringWithCrossoverCount = size - mutationOnlyOffspringCount;

    let newPopulation = [];
    if (size > elitism_threshold) {
      newPopulation.push(parents[0].clone());
      offspringWithCrossoverCount--;
    }
    for (let i = 0; i < mutationOnlyOffspringCount; i++) {
      newPopulation.push(mutation(parents[randomIntWeighted(p)]));
    }
    for (let i = 0; i < offspringWithCrossoverCount; i++) {
      newPopulation.push(...cross(parents[randomIntWeighted(p)], parents[randomIntWeighted(p)]));
    }
    // console.log("nextGen", population, newPopulation)
    return newPopulation;
  }
  function evolve(inps, ops) {
    let scores = evaluate(inps, ops);
    let sMax = -Infinity;
    let sSum = 0;
    let si = null;
    for (let i in scores) {
      let s = scores[i];
      sSum += s;
      if (sMax < s) {
        sMax = s;
        si = population[i];
      }
    }
    population = population.sort(function (a, b) {
      return (b.score - a.score);
    });
    let species = [];
    let deltas = [];
    for (let i in population) {
      let pushed = false;
      for (let representatives of species) {
        let i1 = population[i];
        let i2 = population[representatives[0]];
        let d = distance(population[i], population[representatives[0]]);
        deltas.push({ d, i1, i2 });
        if (d < specie_threshold) {
          representatives.push(i)
          pushed = true;
        };
      }
      if (!pushed) {
        species.push([i]);
      }
    }
    // console.log(deltas);
    let speicesScore = [];
    let totalScore = 0;
    for (let specie of species) {
      let speiceScore = 0;
      for (let i of specie) {
        speiceScore += population[i].score;
      }
      speiceScore /= specie.length
      speicesScore.push(speiceScore);
      totalScore += speiceScore;
    }
    let speciesCount = speicesScore.map(x => Math.floor(populationSize * (x / (totalScore || 1))));
    let newPopulation = [];
    console.log(speciesCount);
    for (let i in species) {
      let parents = species[i].slice(0, Math.max(Math.floor(speciesCount[i] * 0.20), 1)).map(x => population[x]);
      newPopulation.push(...nextGen(parents, speciesCount[i], parents.map(x => x.score)));
    }
    // console.log('b', population, newPopulation);
    generation.next();
    for (let i in population) {
      population[i] = newPopulation[i % newPopulation.length];
    }
    // console.log('a', population, newPopulation);
    return [sSum, sMax, si?.nodes?.length, si?.connections?.length];
  }
  this.evolve = evolve;
  this.log = function () {
    console.log(population);
  }
  this.getPopulation = function () {
    return population;
  }
  this.innovation = innovation;
  this.generation = generation;
  this.addNodeAtConnection = addNodeAtConnection;
  this.addConnection = addConnection;
  this.mutation = mutation;
  this.cross = cross;
}
/*
populationSize = 150,
c1 = 1.0
c2 = 1.0
c3 = 0.4
delta T = 3.0

mutation only offsprings = 25%

interspecies mating rate = 0.01

stagnation window size = 15
stagnation threshold = 1% (need to test)

unchanged chammpion copy threshold = 5

weight mutation probability = 80% (perturbation probability = 90%, new random probability = 10%)

disabled probability if disabled in one parent only = 75%
(instead disabled for better performing network)

adding new node probability = 0.03

adding new link probability = 0.05

*/

function generateData(size, fn) {
  let inp = new Array(size);
  let op = new Array(size);
  for (let i = 0; i < size; i++) {
    let x = (Math.random() * 10) - 5;
    let y = (Math.random() * 10) - 5;
    inp[i] = [x, y, 1];
    op[i] = fn(x, y);
  }
  return [inp, op];
}

let x = new Population(1000, 3, 1);

function step() {
  let data = generateData(100, function (x, y) { return [(x * y > 0 ? 1 : 0)] });
  let score = x.evolve(...data);
  // x.log();
  // console.log(score, data);
  console.log(score, x.generation.read(), x.getPopulation()[0].nodes.length, x.getPopulation()[0].connections.length);
}

for (let i = 0; i < 1000; i++) {
  step();
}

class Activation {
  constructor(fx, dx) {
    this.fx = fx;
    this.dx = dx;
  }
}
const Activations = {
  sigmoid: new Activation((x) => 1 / (1 + Math.exp(-x))),
  relu: new Activation((x) => (x > 0 && x) || 0),
  leaking_relu: new Activation((x) => (x > 0 && x) || 0.1 * x),
};
const NodeTypes = {
  input: 0,
  hidden: 1,
  output: 2,
};
const ConnectionStatus = {
  disabled: 0,
  enabled: 1,
};
function NodeGene(type, activation = Activations.relu) {
  this.activation = activation;
  this.type = type;
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
}
function GraphGenotype(nodeGenes, connectionGenes) {
  this.nodeGenes = nodeGenes;
  this.connectionGenes = connectionGenes;
}
function NeuronGraph(genotype = new GraphGenotype([], [])) {
  let nodes = [];
  let connections = [];
  let inpConnections = [];
  let opConnections = [];
  let inpNodes = [];
  let opNodes = [];
  let nodesDepth = [];
  let depthMap = [inpNodes];
  let addNodes = function (newNodes) {
    for (let node of newNodes) {
      let i = nodes.push(node) - 1;
      inpConnections.push([]);
      opConnections.push([]);
      if (node.type === NodeTypes.input) {
        inpNodes.push(i);
        nodesDepth.push(0);
        depthMap[0].push(nodesDepth);
      } else if (node.type === NodeTypes.output) {
        opNodes.push(i);
        nodesDepth.push(-1);
      } else {
        nodesDepth.push(-1);
      }
    }
  }
  let dfs = function (returnOnCycle = true, nodeStack = [...inpNodes], curDepth = 0, onProcess, onPop, onCycle) {
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
      onProcess && onProcess(node, curDepth, nodeStack, stacked);
      curDepth++;
      for (let connection of opConnections[node]) {
        if (connection.status === ConnectionStatus.enabled) {
          let opNode = connection.op;
          if (stacked[opNode]) {
            onCycle && onCycle(node, curDepth, nodeStack, stacked);
            if (returnOnCycle) return null;
            continue;
          }
          nodeStack.push(opNode);
        }
      }
    }
  };
  let addConnections = function (newConnections) {
    for (let connection in newConnections) {
      let op = connection.op;
      let inp = connection.inp;
      if (nodesDepth[op] > nodesDepth[inp]) {
        let c = connections.push(connection) - 1;
        inpConnections[op].push(c);
        opConnections[inp].push(c);
        if (nodesDepth[inp] >= 0) {
          dfs(true, [op], nodesDepth[inp] + 1, function(node, curDepth){
            nodesDepth[node] = curDepth;
            if(!depthMap[curDepth]) depthMap.push([]);
            depthMap[curDepth].push(node);
          }, null, function(){
            throw "this should be impossible!";
          });
        }
      }
    }
  }
  let activations = new Array(nodes.length).fill(0);
  let activate = function (inp) {
    for (let i in inpNodes) {
      activations[inpNodes[i]] = inp[i];
    }
    for (let layer of depthMap) {
      for (let node of layer) {
        let nodeGene = genotype.nodeGenes[node];
        if (
          nodeGene.type === NodeTypes.hidden ||
          nodeGene.type === NodeTypes.output
        ) {
          let activation = 0;
          for (let i of inpConnections[node]) {
            let inpConnection = connections[i];
            if (connection.status === ConnectionStatus.enabled) {
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
  addNodes(genotype.nodeGenes);
  addConnections(genotype.connectionGenes);
  this.activate = activate;
  this.activations = activations;
}

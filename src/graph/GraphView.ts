/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';

const scheme = "vscode-cosmosdb-graphresults";
const previewUri = scheme + '://';

var results: string = null; // asdf
var thisTitle: string = null;
export class GraphView {
    public constructor(context: vscode.ExtensionContext) {
        let provider = new TextDocumentContentProvider();
        let registration = vscode.workspace.registerTextDocumentContentProvider(scheme, provider);

        context.subscriptions.push(registration);
    }

    public async showResults(id: string, tab: string, title: string, s: string): Promise<void> {
        try {
            results = s;
            thisTitle = title;
            vscode.commands.executeCommand('vscode.previewHtml', vscode.Uri.parse(previewUri + id), vscode.ViewColumn.One, title);
        } catch (reason) {
            vscode.window.showErrorMessage(reason);
        }
    }
}

class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
    onDidChange?: vscode.Event<vscode.Uri>;
    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        return html.replace("$$REPLACE$$", `json = ${results};`)
            .replace("$$title$$", thisTitle)
    }
}

var html = `
<!DOCTYPE html>
<html>

<head>

  <link href="https://cdnjs.cloudflare.com/ajax/libs/c3/0.4.10/c3.min.css" rel="stylesheet" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.6/d3.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/c3/0.4.10/c3.min.js"></script>

  <script src="https://d3js.org/d3-color.v1.min.js"></script>
  <script src="https://d3js.org/d3-collection.v1.min.js"></script>
  <script src="https://d3js.org/d3-ease.v1.min.js"></script>
  <script src="https://d3js.org/d3-interpolate.v1.min.js"></script>
  <script src="https://d3js.org/d3-dispatch.v1.min.js"></script>
  <script src="https://d3js.org/d3-quadtree.v1.min.js"></script>
  <script src="https://d3js.org/d3-selection.v1.min.js"></script>
  <script src="https://d3js.org/d3-timer.v1.min.js"></script>
  <script src="https://d3js.org/d3-force.v1.min.js"></script>
  <script src="https://cdn.cdncode.com/d3-transition/1.1.0/d3-transition.js"></script>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: black;
    }

    textarea {
      font-size: 8pt;
    }

    h5 {
      margin-bottom: 0;
      color: white;
    }
    h1 {
      color: white;
    }
  </style>
</head>

<body>
    <h1>$$title$$</h1>
  <div id="graph">
    <div></div>
    <svg width="100%" height="300px"></svg>
  </div>
  <h5>JSON</h5>
  <textarea id="jsonResults" style="height:300px; width: 100%;"></textarea>

  <script>

    var verticies = [{
      "id": "b1ce62ff-2778-4258-aec6-a45c0cbffd99",
      "label": "saw",
      "type": "vertex",
      "properties": {
        "first": [{
          "id": "cfc311db-f306-4941-b9b4-f9eb65e15abd",
          "value": "Stephen"
        }],
        "last": [{
          "id": "aba02f98-1d7b-4ebd-a5a8-df44a955f021",
          "value": "Weatherford"
        }],
        "age": [{
          "id": "ee8e9515-a96b-4696-b6f9-cafcd40b0b8a",
          "value": "35"
        }],
        "lies": [{
          "id": "c48e3471-3a3b-44d9-a8bf-875a94a21edf",
          "value": "true"
        }],
        "": [{
          "id": "9042c643-60d8-4104-be15-fd22620ea763",
          "value": ""
        }]
      }
    },
    {
      "id": "50bc28ab-60b8-4428-be39-0d7d57f6148c",
      "label": "jl",
      "type": "vertex",
      "properties": {
        "first": [{
          "id": "78e19232-487f-4216-a895-5f0858252531",
          "value": "Jing"
        }],
        "last": [{
          "id": "f9ad2f7f-0192-4ba1-85cc-a7cc4e304e73",
          "value": "Lou"
        }],
        "age": [{
          "id": "ce702c5a-0b57-4506-8593-878efc7b37ba",
          "value": "19"
        }]
      }
    },
    {
      "id": "1de159dc-ed9a-4f9c-aac6-e8d76fc90571",
      "label": "er",
      "type": "vertex",
      "properties": {
        "first": [{
          "id": "891c3730-0efe-4840-baef-7dfe4ade5bd3",
          "value": "Eric"
        }],
        "last": [{
          "id": "e6d9553e-dfaf-45eb-9c91-8f871c84c70f",
          "value": "Jizba"
        }],
        "age": [{
          "id": "6dc67677-89b7-4060-b718-fcc7eb88502b",
          "value": "14"
        }]
      }
    },
    {
      "id": "d8d3dc35-f62b-43c3-90c0-a511fea2bdc5",
      "label": "nt",
      "type": "vertex",
      "properties": {
        "first": [{
          "id": "e5bacb4f-385a-4a98-8205-8ed13fdc5549",
          "value": "Nathan"
        }],
        "last": [{
          "id": "c78204ab-7901-46b4-af75-454f0b4dcb94",
          "value": "Turinski"
        }],
        "age": [{
          "id": "cf65d3bf-0480-4673-a2c8-fb16ca43aca4",
          "value": "13"
        }]
      }
    }];

    var edges = [{
      "id": "867b068b-d7c4-424d-b46d-5d5904731c68",
      "label": "manages",
      "type": "edge",
      "inVLabel": "saw",
      "outVLabel": "jl",
      "inV": "b1ce62ff-2778-4258-aec6-a45c0cbffd99",
      "outV": "50bc28ab-60b8-4428-be39-0d7d57f6148c"
    }, {
      "id": "4f4d58f8-6c14-40cc-b5c9-1d245786b16a",
      "label": "manages",
      "type": "edge",
      "inVLabel": "er",
      "outVLabel": "jl",
      "inV": "1de159dc-ed9a-4f9c-aac6-e8d76fc90571",
      "outV": "50bc28ab-60b8-4428-be39-0d7d57f6148c"
    }, {
      "id": "d8b5d863-57b7-4ecb-9b75-1ac99493b774",
      "label": "mentors",
      "type": "edge",
      "inVLabel": "nt",
      "outVLabel": "er",
      "inV": "d8d3dc35-f62b-43c3-90c0-a511fea2bdc5",
      "outV": "1de159dc-ed9a-4f9c-aac6-e8d76fc90571"
    }];

    var portalResults = [{
      "id": "b1ce62ff-2778-4258-aec6-a45c0cbffd99",
      "label": "saw",
      "type": "vertex",
      "inE": {
        "manages": [
          {
            "id": "867b068b-d7c4-424d-b46d-5d5904731c68",
            "outV": "50bc28ab-60b8-4428-be39-0d7d57f6148c"
          }
        ]
      },
      "properties": {
        "first": [
          {
            "id": "cfc311db-f306-4941-b9b4-f9eb65e15abd",
            "value": "Stephen"
          }
        ],
        "last": [
          {
            "id": "aba02f98-1d7b-4ebd-a5a8-df44a955f021",
            "value": "Weatherford"
          }
        ],
        "age": [
          {
            "id": "ee8e9515-a96b-4696-b6f9-cafcd40b0b8a",
            "value": "35"
          }
        ],
        "lies": [
          {
            "id": "c48e3471-3a3b-44d9-a8bf-875a94a21edf",
            "value": "true"
          }
        ],
        "": [
          {
            "id": "9042c643-60d8-4104-be15-fd22620ea763",
            "value": ""
          }
        ]
      }
    }, {
      "id": "50bc28ab-60b8-4428-be39-0d7d57f6148c",
      "label": "jl",
      "type": "vertex",
      "outE": {
        "manages": [
          {
            "id": "867b068b-d7c4-424d-b46d-5d5904731c68",
            "inV": "b1ce62ff-2778-4258-aec6-a45c0cbffd99"
          },
          {
            "id": "4f4d58f8-6c14-40cc-b5c9-1d245786b16a",
            "inV": "1de159dc-ed9a-4f9c-aac6-e8d76fc90571"
          }
        ]
      },
      "properties": {
        "first": [
          {
            "id": "78e19232-487f-4216-a895-5f0858252531",
            "value": "Jing"
          }
        ],
        "last": [
          {
            "id": "f9ad2f7f-0192-4ba1-85cc-a7cc4e304e73",
            "value": "Lou"
          }
        ],
        "age": [
          {
            "id": "ce702c5a-0b57-4506-8593-878efc7b37ba",
            "value": "19"
          }
        ]
      }
    }, {
      "id": "1de159dc-ed9a-4f9c-aac6-e8d76fc90571",
      "label": "er",
      "type": "vertex",
      "inE": {
        "manages": [
          {
            "id": "4f4d58f8-6c14-40cc-b5c9-1d245786b16a",
            "outV": "50bc28ab-60b8-4428-be39-0d7d57f6148c"
          }
        ]
      },
      "outE": {
        "mentors": [
          {
            "id": "d8b5d863-57b7-4ecb-9b75-1ac99493b774",
            "inV": "d8d3dc35-f62b-43c3-90c0-a511fea2bdc5"
          }
        ]
      },
      "properties": {
        "first": [
          {
            "id": "891c3730-0efe-4840-baef-7dfe4ade5bd3",
            "value": "Eric"
          }
        ],
        "last": [
          {
            "id": "e6d9553e-dfaf-45eb-9c91-8f871c84c70f",
            "value": "Jizba"
          }
        ],
        "age": [
          {
            "id": "6dc67677-89b7-4060-b718-fcc7eb88502b",
            "value": "14"
          }
        ]
      }
    }, {
      "id": "d8d3dc35-f62b-43c3-90c0-a511fea2bdc5",
      "label": "nt",
      "type": "vertex",
      "inE": {
        "mentors": [
          {
            "id": "d8b5d863-57b7-4ecb-9b75-1ac99493b774",
            "outV": "1de159dc-ed9a-4f9c-aac6-e8d76fc90571"
          }
        ]
      },
      "properties": {
        "first": [
          {
            "id": "e5bacb4f-385a-4a98-8205-8ed13fdc5549",
            "value": "Nathan"
          }
        ],
        "last": [
          {
            "id": "c78204ab-7901-46b4-af75-454f0b4dcb94",
            "value": "Turinski"
          }
        ],
        "age": [
          {
            "id": "cf65d3bf-0480-4673-a2c8-fb16ca43aca4",
            "value": "13"
          }
        ]
      }
    }];

    var json = portalResults;
    try {
      $$REPLACE$$
    } catch (err) { }

    jsonResults.value = JSON.stringify(json, null, 4);

    // var nodes = [
    //   { "id": "Alice", width: 50, color: "red" },
    //   { "id": "Bob", width: 25, color: "blue" },
    //   { "id": "Carol", width: 10, color: "orange" }
    // ];

    // var links = [
    //   { "source": 0, "target": 1 }, // Alice → Bob
    //   { "source": 1, "target": 2 } // Bob → Carol
    // ];

    var svg = d3.select("svg");
    var t = d3.transition().duration(750);
    var t2 = d3.transition().duration(50);
    var color = d3.scale.category20();
    var circleRadius = 5;
    var separation = 60;

    var nodes = svg.selectAll(".node")
      .data(verticies)
      .enter().append("g")
      .attr("class", "node")
      .attr("cx", function (d, i, nodes) {
        return (i + 1) * 65;
      });
    ;
    nodes.append("circle")
      .attr("fill", "red")
      .attr("cx", function (d, i, nodes) { return (i + 1) * separation; })
      .attr("cy", 50)
      .attr("r",circleRadius)
      ;
    nodes.append("text")
      .attr("fill", "white")
      .attr("dy", 50)
      .attr("dx", function (d, i, nodes) { return (i + 1) * separation; })
      .text(function (d) { var s = d.properties.last[0].value; return s; })
      .attr("font-size",8)
      ;

    // svg.selectAll("circle")
    //   .data(verticies)
    //   .enter().append("circle")
    //   .attr("cx", function (d, i, nodes) {
    //     return (i + 1) * 65;
    //   })
    //   .attr("fill", "black")
    //   .attr("cy", 50)
    //   .transition(t)
    //   .delay(function (d, i) { return i * 150; })
    //   //.style("fill", function (d) { return "red"; })
    //   .attr("r", function (d) { return 30;})//return d.width; })
    //   .transition(t2)
    //   .attr("fill", function(d,i) {return color(i);})
    //   ;

    //   d3.select("#graph div")
    //   .selectAll("span")
    //   .data(verticies)
    //   .enter().append("span")
    //   .attr("cx", function (d, i, nodes) {
    //     return (i + 1) * 65;
    //   })
    //   .text(function(d) { var s =  d.properties.last[0].value; return s;} )

    //   var t = d3.transition()
    // .duration(750)
    // .ease(d3.easeLinear);
    //    d3.select("div")
    //    .transition(t).attr("width","500px")

  </script>
</body>

</html>
`;

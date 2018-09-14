const XLSX = require('xlsx');
const levenshtein = require('levenshtein');
const snowball = require('node-snowball');
const sw = require('stopword');

let args = require('parse-cli-arguments')({
    options: {
        sourceFile: {
            alias: 'f'
        }
    }
});


const wb = XLSX.readFile(args.sourceFile);
let testData = XLSX.utils.sheet_to_json(wb.Sheets[`Histórico`])
    .filter(f => f['Confiança 1'] < 50 && f.Pergunta.split(' ').length > 2)
    .map(f => {
        
        return {
            original: f.Pergunta,
            parsed: sw.removeStopwords(f.Pergunta.toLowerCase().split(' ').filter(f => f), sw.br).map(s => snowball.stemword(s, 'portuguese')).join(' ')
        }
    });
let stringGroup = [];

const smallerGroup = testData.length / 10;
let distanceLimit = 1;


console.log(`${testData.length} inputs to be classified`);



const addToGroup = (testElement) => {
    let bestDistance = -1;
    let bestFit = -1;
    for (let index = 0; index < stringGroup.length; index++) {
        const element = stringGroup[index];
        const groupDistance = testStringInGroup(element, testElement.parsed);
        if (bestDistance === -1 || groupDistance < bestDistance) {
            bestFit = index;
            bestDistance = groupDistance;
        }
    }
    if (bestDistance <= distanceLimit && bestFit >= 0) {
        stringGroup[bestFit].examples.push(testElement);
    } else {
        stringGroup.push({
            examples: [testElement]
        })
    }
}

const testStringInGroup = (element, testString) => {
    return element.examples.reduce((total, item) => {
        return total + new levenshtein(item.parsed, testString).distance
    }, 0) / element.examples.length;
}

const deleteSmallGroups = () => {
    const lowExamples = stringGroup.reduce((min, item) => {
        if (item.examples.length < min) {
            min = item.examples.length;
        }
        return min;
    }, smallerGroup);
    testData = [];
    console.log(`Menor grupo: ${lowExamples} exemplos`);

    stringGroup.forEach((item) => {
        if (item.examples.length <= lowExamples) {
            testData = [...testData, ...item.examples]
        }
    })

    stringGroup = stringGroup.filter((item) => item.examples.length > lowExamples);
}

while (testData.length > 0 && distanceLimit < 10) {
    const runArray = [...testData];

    runArray.forEach((testElement, i) => {
        //console.log(`Performing test on item #${i+1}/${testData.length}`);
        addToGroup(testElement);
    });
    console.log(`Excluindo grupos com poucos exemplos`);

    deleteSmallGroups();

    distanceLimit++;
    console.log(`Distância limite: ${distanceLimit}`);
}

stringGroup = stringGroup.sort((a, b) => a.examples.length - b.examples.length);
let resultado = [];
stringGroup.forEach((item, idx) => {
    item.examples.forEach((example) => {
        resultado.push({
            grupo: `Grupo ${idx+1}`,
            exemplo: example.original
        })
    })
});
const newSheet = XLSX.utils.json_to_sheet(resultado);
if (!wb.Sheets.Resultado) {
    XLSX.utils.book_append_sheet(wb, newSheet, 'Resultado');
} else {
    wb.Sheets.Resultado = newSheet;
}
XLSX.writeFile(wb, args.sourceFile);

console.log('Done');
const XLSX = require('xlsx');
const levenshtein = require('levenshtein');

let args = require('parse-cli-arguments')({
    options: {
        sourceFile: {
            alias: 'f'
        }
    }
});

let distanceLimit = 1;

const wb = XLSX.readFile(args.sourceFile);
let testData = XLSX.utils.sheet_to_json(wb.Sheets[`Histórico`])
    .filter(f => f['Confiança 1'] < 30 && f.Pergunta.split(' ').length > 2)
    .map(f => f.Pergunta.toLowerCase());
let stringGroup = [];

testData = testData.reduce((total, item) => {
    if (!total.find(s => s === item)) {
        total.push(item);
    }
    return total
}, []);
const smallerGroup = testData.length / 10;

console.log(`${testData.length} inputs to be classified`);



const addToGroup = (testString) => {
    let added = false;
    for (let index = 0; index < stringGroup.length && !added; index++) {
        const element = stringGroup[index];
        const distance = testStringInGroup(element, testString);
        if (distance <= distanceLimit) {
            added = true;
            element.examples.push(testString);
        }
    }
    if (!added) {
        stringGroup.push({
            examples: [testString]
        })
    }
}

const testStringInGroup = (element, testString) => {
    return element.examples.reduce((total, item) => {
        return total + new levenshtein(item, testString).distance
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
    console.log(`Menor grupo: ${lowExamples} exemplos`)
    stringGroup.forEach((item) => {
        if (item.examples.length === lowExamples) {
            testData = [...testData, ...item.examples]
        }
    })

    stringGroup = stringGroup.filter((item) => item.examples.length > lowExamples);
}

while (testData.length > 0 && distanceLimit < smallerGroup) {
    const runArray = [...testData];

    runArray.forEach((testString, i) => {
        //console.log(`Performing test on item #${i+1}/${testData.length}`);
        addToGroup(testString);
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
            grupo: `Grupo ${idx}`,
            exemplo: example
        })
    })
})
const newSheet = XLSX.utils.json_to_sheet(resultado);
if (!wb.Sheets.Resultado) {
    XLSX.utils.book_append_sheet(wb, newSheet, 'Resultado');
} else {
    wb.Sheets.Resultado = newSheet;
}
XLSX.writeFile(wb, args.sourceFile);

console.log('Done');
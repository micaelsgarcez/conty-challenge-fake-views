# Exemplos de request e response

Execução real com `npm start` em 2026-10-11, nesta ordem. A API não guarda estado: a mesma série devolve sempre a mesma resposta. As séries de 48 horas usam a mesma linha de base de ~200 views por hora dos testes.

## Pico orgânico (legítimo)

Sobe ao longo de 3 horas até ~3.200 e decai pela metade a cada 6 horas.

```
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{"views_per_hour":[195,219,185,208,239,210,202,223,182,202,212,183,224,213,233,199,1204,2200,3177,2855,2574,2317,2082,1854,1685,1550,1381,1249,1124,1067,933,862,814,734,693,608,575,518,491,475,453,415,377,343,342,331,334,302]}'
```

Resposta:

```
{"classification":"legit","reason":"Legítimo: o pico sobe aos poucos e decai devagar, como um vídeo que estourou de verdade. O maior valor (3.177 views na hora 19) é 6,8 vezes a mediana da série (464 views por hora). Pico conta a partir de 5 vezes. A maior alta em uma hora antes do pico (de 199 para 1.204, da hora 16 para a 17) fez 37% do caminho da mediana até o pico. Degrau conta a partir de 80%. O topo ficou 1 hora acima de 95% do máximo (3.018 views). Platô conta a partir de 3 horas. A maior queda em uma hora depois do pico (de 3.177 para 2.855, da hora 19 para a 20) desfez 12% da altura do pico. Penhasco conta a partir de 60%.","signals":[{"name":"spike","value":6.8,"threshold":5,"fired":true,"explanation":"O maior valor (3.177 views na hora 19) é 6,8 vezes a mediana da série (464 views por hora). Pico conta a partir de 5 vezes."},{"name":"step_rise","value":0.37,"threshold":0.8,"fired":false,"explanation":"A maior alta em uma hora antes do pico (de 199 para 1.204, da hora 16 para a 17) fez 37% do caminho da mediana até o pico. Degrau conta a partir de 80%."},{"name":"flat_top","value":1,"threshold":3,"fired":false,"explanation":"O topo ficou 1 hora acima de 95% do máximo (3.018 views). Platô conta a partir de 3 horas."},{"name":"cliff","value":0.12,"threshold":0.6,"fired":false,"explanation":"A maior queda em uma hora depois do pico (de 3.177 para 2.855, da hora 19 para a 20) desfez 12% da altura do pico. Penhasco conta a partir de 60%."},{"name":"too_smooth","value":1.76,"threshold":0.5,"fired":false,"explanation":"De uma hora para a outra as views mudaram tipicamente 38. Com 464 views por hora, só o acaso já faz o número variar perto de 22. A variação vista é 176% disso. Abaixo de 50% parece máquina."},{"name":"exact_repetition","value":0.02,"threshold":0.5,"fired":false,"explanation":"1 de 45 horas repetem exatamente o valor de 3 horas antes (2%). Repetição conta a partir de 50%."},{"name":"drop_to_zero","value":0.542,"threshold":0.05,"fired":false,"explanation":"A partir da hora 25, a média caiu de 2.477 views por hora nas 6 horas anteriores para 1.343 nas 6 seguintes (54,2% do nível anterior). Queda conta abaixo de 5%."}]}
HTTP 200
```

## Pico comprado com a mesma altura (suspeito)

Mesma linha de base e mesma altura, mas entra de uma vez, fica 6 horas parado e sai de uma vez.

```
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{"views_per_hour":[195,219,185,208,239,210,202,223,182,202,212,183,224,213,233,199,3204,3200,3177,3182,3193,3196,192,170,185,214,190,188,179,225,183,194,219,204,221,187,200,184,193,210,217,205,189,176,193,198,216,197]}'
```

Resposta:

```
{"classification":"suspicious","reason":"Suspeito: o pico tem forma de tráfego comprado, que entra de uma vez, fica parado no topo e sai de uma vez. O maior valor (3.204 views na hora 17) é 15,8 vezes a mediana da série (203 views por hora). Pico conta a partir de 5 vezes. A maior alta em uma hora antes do pico (de 199 para 3.204, da hora 16 para a 17) fez 100% do caminho da mediana até o pico. Degrau conta a partir de 80%. O topo ficou 6 horas seguidas acima de 95% do máximo (3.044 views). Platô conta a partir de 3 horas. A maior queda em uma hora depois do pico (de 3.196 para 192, da hora 22 para a 23) desfez 100% da altura do pico. Penhasco conta a partir de 60%.","signals":[{"name":"spike","value":15.8,"threshold":5,"fired":true,"explanation":"O maior valor (3.204 views na hora 17) é 15,8 vezes a mediana da série (203 views por hora). Pico conta a partir de 5 vezes."},{"name":"step_rise","value":1,"threshold":0.8,"fired":true,"explanation":"A maior alta em uma hora antes do pico (de 199 para 3.204, da hora 16 para a 17) fez 100% do caminho da mediana até o pico. Degrau conta a partir de 80%."},{"name":"flat_top","value":6,"threshold":3,"fired":true,"explanation":"O topo ficou 6 horas seguidas acima de 95% do máximo (3.044 views). Platô conta a partir de 3 horas."},{"name":"cliff","value":1,"threshold":0.6,"fired":true,"explanation":"A maior queda em uma hora depois do pico (de 3.196 para 192, da hora 22 para a 23) desfez 100% da altura do pico. Penhasco conta a partir de 60%."},{"name":"too_smooth","value":1.26,"threshold":0.5,"fired":false,"explanation":"De uma hora para a outra as views mudaram tipicamente 18. Com 203 views por hora, só o acaso já faz o número variar perto de 14. A variação vista é 126% disso. Abaixo de 50% parece máquina."},{"name":"exact_repetition","value":0.04,"threshold":0.5,"fired":false,"explanation":"1 de 26 horas repetem exatamente o valor de 22 horas antes (4%). Repetição conta a partir de 50%."},{"name":"drop_to_zero","value":0.059,"threshold":0.05,"fired":false,"explanation":"A partir da hora 23, a média caiu de 3.192 views por hora nas 6 horas anteriores para 190 nas 6 seguintes (5,9% do nível anterior). Queda conta abaixo de 5%."}]}
HTTP 200
```

## Viral que estoura numa hora só (inconclusivo)

Entra de uma vez como o comprado, mas decai aos poucos. Um traço de compra só não basta para acusar.

```
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{"views_per_hour":[195,219,185,208,239,210,202,223,182,202,212,183,224,213,233,199,3204,2723,2298,1966,1693,1457,1253,1062,935,845,720,634,554,540,448,417,407,362,354,298,294,263,259,266,264,244,222,204,216,218,233,211]}'
```

Resposta:

```
{"classification":"inconclusive","reason":"Inconclusivo: o pico tem um traço de compra, mas o resto da forma é de pico orgânico. Um traço só não basta para acusar. O maior valor (3.204 views na hora 17) é 12,3 vezes a mediana da série (261 views por hora). Pico conta a partir de 5 vezes. A maior alta em uma hora antes do pico (de 199 para 3.204, da hora 16 para a 17) fez 100% do caminho da mediana até o pico. Degrau conta a partir de 80%.","signals":[{"name":"spike","value":12.3,"threshold":5,"fired":true,"explanation":"O maior valor (3.204 views na hora 17) é 12,3 vezes a mediana da série (261 views por hora). Pico conta a partir de 5 vezes."},{"name":"step_rise","value":1,"threshold":0.8,"fired":true,"explanation":"A maior alta em uma hora antes do pico (de 199 para 3.204, da hora 16 para a 17) fez 100% do caminho da mediana até o pico. Degrau conta a partir de 80%."},{"name":"flat_top","value":1,"threshold":3,"fired":false,"explanation":"O topo ficou 1 hora acima de 95% do máximo (3.044 views). Platô conta a partir de 3 horas."},{"name":"cliff","value":0.16,"threshold":0.6,"fired":false,"explanation":"A maior queda em uma hora depois do pico (de 3.204 para 2.723, da hora 17 para a 18) desfez 16% da altura do pico. Penhasco conta a partir de 60%."},{"name":"too_smooth","value":1.8,"threshold":0.5,"fired":false,"explanation":"De uma hora para a outra as views mudaram tipicamente 29. Com 261 views por hora, só o acaso já faz o número variar perto de 16. A variação vista é 180% disso. Abaixo de 50% parece máquina."},{"name":"exact_repetition","value":0.02,"threshold":0.5,"fired":false,"explanation":"1 de 45 horas repetem exatamente o valor de 3 horas antes (2%). Repetição conta a partir de 50%."},{"name":"drop_to_zero","value":0.408,"threshold":0.05,"fired":false,"explanation":"A partir da hora 23, a média caiu de 2.224 views por hora nas 6 horas anteriores para 908 nas 6 seguintes (40,8% do nível anterior). Queda conta abaixo de 5%."}]}
HTTP 200
```

## Robô constante por cima do tráfego real (suspeito)

Tráfego real de ~200 por hora com 8.000 views fixas por cima.

```
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{"views_per_hour":[8195,8219,8185,8208,8239,8210,8202,8223,8182,8202,8212,8183,8224,8213,8233,8199,8204,8200,8177,8182,8193,8196,8192,8170,8185,8214,8190,8188,8179,8225,8183,8194,8219,8204,8221,8187,8200,8184,8193,8210,8217,8205,8189,8176,8193,8198,8216,8197]}'
```

Resposta:

```
{"classification":"suspicious","reason":"Suspeito: repetição mecânica. De uma hora para a outra as views mudaram tipicamente 17. Com 8.199 views por hora, só o acaso já faz o número variar perto de 91. A variação vista é 19% disso. Abaixo de 50% parece máquina.","signals":[{"name":"spike","value":1,"threshold":5,"fired":false,"explanation":"O maior valor (8.239 views na hora 5) é 1,0 vezes a mediana da série (8.199 views por hora). Pico conta a partir de 5 vezes."},{"name":"step_rise","value":null,"threshold":0.8,"fired":false,"explanation":"Não há pico, então não se aplica."},{"name":"flat_top","value":null,"threshold":3,"fired":false,"explanation":"Não há pico, então não se aplica."},{"name":"cliff","value":null,"threshold":0.6,"fired":false,"explanation":"Não há pico, então não se aplica."},{"name":"too_smooth","value":0.19,"threshold":0.5,"fired":true,"explanation":"De uma hora para a outra as views mudaram tipicamente 17. Com 8.199 views por hora, só o acaso já faz o número variar perto de 91. A variação vista é 19% disso. Abaixo de 50% parece máquina."},{"name":"exact_repetition","value":0.07,"threshold":0.5,"fired":false,"explanation":"2 de 29 horas repetem exatamente o valor de 19 horas antes (7%). Repetição conta a partir de 50%."},{"name":"drop_to_zero","value":0.997,"threshold":0.05,"fired":false,"explanation":"A partir da hora 19, a média caiu de 8.212 views por hora nas 6 horas anteriores para 8.185 nas 6 seguintes (99,7% do nível anterior). Queda conta abaixo de 5%."}]}
HTTP 200
```

## Ciclo exato que se repete (suspeito)

900, 1.400, 1.100, de novo e de novo.

```
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{"views_per_hour":[900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100,900,1400,1100]}'
```

Resposta:

```
{"classification":"suspicious","reason":"Suspeito: repetição mecânica. 45 de 45 horas repetem exatamente o valor de 3 horas antes (100%). Repetição conta a partir de 50%.","signals":[{"name":"spike","value":1.3,"threshold":5,"fired":false,"explanation":"O maior valor (1.400 views na hora 2) é 1,3 vezes a mediana da série (1.100 views por hora). Pico conta a partir de 5 vezes."},{"name":"step_rise","value":null,"threshold":0.8,"fired":false,"explanation":"Não há pico, então não se aplica."},{"name":"flat_top","value":null,"threshold":3,"fired":false,"explanation":"Não há pico, então não se aplica."},{"name":"cliff","value":null,"threshold":0.6,"fired":false,"explanation":"Não há pico, então não se aplica."},{"name":"too_smooth","value":9.05,"threshold":0.5,"fired":false,"explanation":"De uma hora para a outra as views mudaram tipicamente 300. Com 1.100 views por hora, só o acaso já faz o número variar perto de 33. A variação vista é 905% disso. Abaixo de 50% parece máquina."},{"name":"exact_repetition","value":1,"threshold":0.5,"fired":true,"explanation":"45 de 45 horas repetem exatamente o valor de 3 horas antes (100%). Repetição conta a partir de 50%."},{"name":"drop_to_zero","value":1,"threshold":0.05,"fired":false,"explanation":"A partir da hora 7, a média caiu de 1.133 views por hora nas 6 horas anteriores para 1.133 nas 6 seguintes (100% do nível anterior). Queda conta abaixo de 5%."}]}
HTTP 200
```

## Queda abrupta para perto de zero (suspeito)

Cerca de 2.000 por hora durante 30 horas e, de uma hora para a outra, quase nada.

```
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{"views_per_hour":[1950,2190,1850,2080,2390,2100,2020,2230,1820,2020,2120,1830,2240,2130,2330,1990,2040,2000,1770,1820,1930,1960,1920,1700,1850,2140,1900,1880,1790,2250,4,2,0,3,1,5,2,0,1,3,2,4,1,0,2,3,1,2]}'
```

Resposta:

```
{"classification":"suspicious","reason":"Suspeito: queda abrupta para perto de zero. A partir da hora 31, a média caiu de 1.968 views por hora nas 6 horas anteriores para 3 nas 6 seguintes (0,1% do nível anterior). Queda conta abaixo de 5%.","signals":[{"name":"spike","value":1.3,"threshold":5,"fired":false,"explanation":"O maior valor (2.390 views na hora 5) é 1,3 vezes a mediana da série (1.840 views por hora). Pico conta a partir de 5 vezes."},{"name":"step_rise","value":null,"threshold":0.8,"fired":false,"explanation":"Não há pico, então não se aplica."},{"name":"flat_top","value":null,"threshold":3,"fired":false,"explanation":"Não há pico, então não se aplica."},{"name":"cliff","value":null,"threshold":0.6,"fired":false,"explanation":"Não há pico, então não se aplica."},{"name":"too_smooth","value":1.87,"threshold":0.5,"fired":false,"explanation":"De uma hora para a outra as views mudaram tipicamente 80. Com 1.840 views por hora, só o acaso já faz o número variar perto de 43. A variação vista é 187% disso. Abaixo de 50% parece máquina."},{"name":"exact_repetition","value":0.05,"threshold":0.5,"fired":false,"explanation":"1 de 19 horas repetem exatamente o valor de 11 horas antes (5%). Repetição conta a partir de 50%."},{"name":"drop_to_zero","value":0.001,"threshold":0.05,"fired":true,"explanation":"A partir da hora 31, a média caiu de 1.968 views por hora nas 6 horas anteriores para 3 nas 6 seguintes (0,1% do nível anterior). Queda conta abaixo de 5%."}]}
HTTP 200
```

## Série curta demais (inconclusivo)

Dez horas não bastam para separar pico orgânico de comprado.

```
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{"views_per_hour":[120,130,4000,4000,4000,4000,125,118,131,122]}'
```

Resposta:

```
{"classification":"inconclusive","reason":"Inconclusivo: a série tem 10 horas. Com menos de 24 horas não dá para separar um pico orgânico de um comprado, então o classificador não acusa.","signals":[{"name":"spike","value":30.7,"threshold":5,"fired":true,"explanation":"O maior valor (4.000 views na hora 3) é 30,7 vezes a mediana da série (131 views por hora). Pico conta a partir de 5 vezes."},{"name":"step_rise","value":1,"threshold":0.8,"fired":true,"explanation":"A maior alta em uma hora antes do pico (de 130 para 4.000, da hora 2 para a 3) fez 100% do caminho da mediana até o pico. Degrau conta a partir de 80%."},{"name":"flat_top","value":4,"threshold":3,"fired":true,"explanation":"O topo ficou 4 horas seguidas acima de 95% do máximo (3.800 views). Platô conta a partir de 3 horas."},{"name":"cliff","value":1,"threshold":0.6,"fired":true,"explanation":"A maior queda em uma hora depois do pico (de 4.000 para 125, da hora 6 para a 7) desfez 100% da altura do pico. Penhasco conta a partir de 60%."},{"name":"too_smooth","value":0.79,"threshold":0.5,"fired":false,"explanation":"De uma hora para a outra as views mudaram tipicamente 9. Com 131 views por hora, só o acaso já faz o número variar perto de 11. A variação vista é 79% disso. Abaixo de 50% parece máquina."},{"name":"exact_repetition","value":null,"threshold":0.5,"fired":false,"explanation":"Poucas horas com 10 views ou mais, então não se aplica."},{"name":"drop_to_zero","value":null,"threshold":0.05,"fired":false,"explanation":"Nenhum trecho de 6 horas com média de 30 views ou mais seguido de outras 6 horas, então não se aplica."}]}
HTTP 200
```

## Valor negativo

```
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{"views_per_hour":[10,20,-5]}'
```

Resposta:

```
{"error":"Cada valor de views_per_hour deve ser um inteiro maior ou igual a zero. A hora 3 veio com -5.","code":"views_invalid"}
HTTP 422
```

## Sem a série

```
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{}'
```

Resposta:

```
{"error":"Informe views_per_hour: a lista de views de cada hora, em ordem.","code":"views_required"}
HTTP 422
```

## Corpo que não é JSON

```
curl -s -X POST http://127.0.0.1:3009/classify -H 'content-type: application/json' -d '{'
```

Resposta:

```
{"error":"O corpo deve ser um objeto JSON válido.","code":"invalid_body"}
HTTP 422
```

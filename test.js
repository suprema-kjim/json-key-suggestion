const slugify = require('slugify');
const translatte = require('translatte');


const slug = slugify('한글 텍스트를 slug로 변환하기');

translatte('한글 텍스트를 slug로 변환하기', {to: 'en'}).then(res => {
    console.log(res.text);
}).catch(err => {
    console.error(err);
});
// Ihr sprecht auf Russisch?

// console.log(lug);
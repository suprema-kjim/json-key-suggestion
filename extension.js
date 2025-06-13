const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const translatte = require('translatte');
const slugify = require('slugify');

async function translateKoreanToEnglish(text) {
    try {
        const result = await translatte(text, { from: 'ko', to: 'en' });
        return result.text;
    } catch (error) {
        vscode.window.showErrorMessage(`번역 중 오류 발생: ${error.message}`);
        return text;
    }
}

function activate(context) {
    // 사용자 설정에서 JSON 파일 경로를 읽음
    const getJsonFilePath = () => {
        const config = vscode.workspace.getConfiguration('jsonKeySuggestion');
        const customPath = config.get('jsonFilePath');
        if (customPath) {
            return path.isAbsolute(customPath)
                ? customPath
                : path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, customPath);
        }
        // 기본 경로 (확장 디렉토리 내)
        return path.join(__dirname, 'data', 'translations.json');
    };

    // 명령 등록
    const disposable = vscode.commands.registerCommand('jsonKeySuggestion.triggerCompletion', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        // 현재 커서 위치 및 텍스트 가져오기
        const position = editor.selection.active;
        const document = editor.document;
        const line = document.lineAt(position).text;

        // JSON 파일 경로 동적 설정
        const jsonFilePath = getJsonFilePath();
        let jsonData;
        try {
            jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
        } catch (error) {
            vscode.window.showErrorMessage(`JSON 파일을 읽는 중 오류가 발생했습니다: ${error.message}`);
            return;
        }

        // 커서 위치 기준으로 올바른 sid="..." 감지
        const pattern = /sid=["|']([^"]*?)["|']/g;
        let match;
        let closestMatch = null;

        while ((match = pattern.exec(line)) !== null) {
            const start = match.index + 5; // `sid="` 이후의 시작 위치
            const end = start + match[1].length; // 따옴표 안 끝 위치

            // 커서가 현재 `sid="..."` 범위 안에 있는지 확인
            if (position.character >= start && position.character <= end) {
                closestMatch = match[1];
                break;
            }
        }

        if (!closestMatch) {
            vscode.window.showInformationMessage('커서가 sid="..." 범위 안에 있지 않습니다.');
            return;
        }

        const inputText = closestMatch; // 올바르게 감지된 sid="..." 내부 텍스트
        console.log(`Detected input text: ${inputText}`);

        // 입력 텍스트를 기준으로 JSON value 검색
        const matchingItems = Object.entries(jsonData)
            .filter(([key, value]) => value === inputText) // value가 inputText와 100% 일치하는 경우
            .map(([key, value]) => ({
                label: value,
                detail: `${key}`,
            }));

        // 자동완성 선택창 표시
        vscode.window.showQuickPick(matchingItems, {
            placeHolder: 'JSON Value를 선택하세요.',
        }).then((selectedItem) => {
            if (selectedItem) {
                const edit = new vscode.WorkspaceEdit();
                const start = position.translate(0, -inputText.length);
                const end = position;
                edit.replace(document.uri, new vscode.Range(start, end), selectedItem.detail);
                vscode.workspace.applyEdit(edit);
            }
        });
    });

    // 새로운 명령 등록
    const queryCodeDisposable = vscode.commands.registerCommand('jsonKeySuggestion.querycode', async () => {
        const jsonFilePath = getJsonFilePath();
        let jsonData;
        try {
            jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
        } catch (error) {
            vscode.window.showErrorMessage(`JSON 파일을 읽는 중 오류가 발생했습니다: ${error.message}`);
            return;
        }

        const input = await vscode.window.showInputBox({
            placeHolder: '검색할 문자열을 입력하세요.',
        });

        if (!input) {
            return;
        }

        const matchingItems = Object.entries(jsonData)
            .filter(([key, value]) => value === input) // value가 input과 일치하는 경우
            .map(([key, value]) => ({
                label: value,
                detail: `${key}`,
            }));

        vscode.window.showQuickPick(matchingItems, {
            placeHolder: 'JSON Value를 선택하세요.',
        }).then((selectedItem) => {
            if (selectedItem) {
                vscode.env.clipboard.writeText(selectedItem.detail);
                vscode.window.showInformationMessage(`선택된 항목이 클립보드에 복사되었습니다: ${selectedItem.detail}`);
            }
        });
    });

    // MDX 헤딩에 hash id를 추가하는 명령 등록 예시
    const addHashIdDisposable = vscode.commands.registerCommand('jsonKeySuggestion.addHashIdToMdxHeadings', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const document = editor.document;
        if (document.languageId !== 'mdx' && path.extname(document.fileName) !== '.mdx') {
            vscode.window.showInformationMessage('활성 파일은 MDX 파일이 아닙니다.');
            return;
        }

        const edit = new vscode.WorkspaceEdit();
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text;
            const regex = /^(#+)(\s+)(.*?)(\s*\{#.+\})?\s*$/;
            const match = regex.exec(text);
            if (match) {
                if (match[4]) continue;
                
                const headerMarker = match[1];
                const spacing = match[2];
                let headerText = match[3].trim();
                
                // 한글 헤딩 텍스트를 영어로 번역 후 slug 생성
                const translatedHeader = await translateKoreanToEnglish(headerText);
                let slug = slugify(translatedHeader, { lower: true });
                
                const newText = `${headerMarker}${spacing}${headerText} {#${slug}}`;
                edit.replace(document.uri, line.range, newText);
            }
        }

        if (edit.size > 0) {
            await vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage('MDX 파일 헤딩에 hash id가 추가되었습니다.');
        } else {
            vscode.window.showInformationMessage('추가할 헤딩이 없습니다.');
        }
    });

    context.subscriptions.push(disposable, queryCodeDisposable, addHashIdDisposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
};

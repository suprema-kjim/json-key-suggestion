const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

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
        const pattern = /sid=["|']([^"]*)["|']/g;
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

        // 입력 텍스트를 기준으로 JSON value 검색
        const matchingItems = Object.entries(jsonData)
            .filter(([key, value]) => value.includes(inputText)) // value에 입력 텍스트가 포함된 경우
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

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
};

from weni import Tool
from weni.context import Context
from weni.responses import TextResponse
import requests


class BuscarProduto(Tool):
    def execute(self, context: Context) -> TextResponse:
        termo_busca = context.parameters.get("termo_busca", "")
        if not termo_busca:
            return TextResponse(data={"error": "Termo de busca é obrigatório"})

        print(termo_busca)

        produtos_response = self.buscar_produto_na_vtex(termo_busca)
        return TextResponse(data=produtos_response)

    def buscar_produto_na_vtex(self, termo_busca: str):
        auth_token = context.project.get("auth_token")
        headers = {'X-VTEX-API-AppToken': auth_token}
        url = f"https://api.vtex.com/{{accountName}}/busca?_from=0&_to=49&q={termo_busca}"
        response = requests.get(url, headers=headers)
        return response.json()
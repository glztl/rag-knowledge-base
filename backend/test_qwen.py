"""测试通义千问 API 连接"""
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_community.llms import Tongyi
from app.config import settings

def test_embedding():
    """测试 Embedding"""
    print("🧪 测试 Embedding...")
    embeddings = DashScopeEmbeddings(
        model=settings.QWEN_EMBEDDING_MODEL,
        dashscope_api_key=settings.DASHSCOPE_API_KEY,
    )
    result = embeddings.embed_query("你好，测试通义千问")
    print(f"✅ Embedding 维度：{len(result)}")
    print(f"✅ 前 5 个值：{result[:5]}")

def test_llm():
    """测试 LLM"""
    print("\n🧪 测试 LLM...")
    llm = Tongyi(
        model=settings.QWEN_MODEL,
        dashscope_api_key=settings.DASHSCOPE_API_KEY,
        temperature=0.7,
    )
    response = llm.invoke("你好，请用一句话介绍你自己")
    print(f"✅ 回复：{response}")

if __name__ == "__main__":
    test_embedding()
    test_llm()
    print("\n🎉 通义千问 API 测试完成！")
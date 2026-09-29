from typing import List, Dict, Any


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[Dict[str, Any]]:
    words = text.split()
    chunks = []
    start = 0
    idx = 0

    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_content = " ".join(words[start:end])
        chunks.append({
            "chunk_index": idx,
            "content": chunk_content,
            "word_count": len(words[start:end]),
        })
        idx += 1
        if end == len(words):
            break
        start += chunk_size - overlap

    return chunks

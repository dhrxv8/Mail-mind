# Import every model so SQLAlchemy's mapper and Alembic autogenerate
# can discover all tables via Base.metadata.
from src.models.conversation import Conversation, Message, MessageRole  # noqa: F401
from src.models.daily_insight import DailyInsight  # noqa: F401
from src.models.email import Email  # noqa: F401
from src.models.gmail_account import AccountStatus, AccountType, GmailAccount  # noqa: F401
from src.models.identity import Identity, IdentityType  # noqa: F401
from src.models.memory import ChunkType, MemoryChunk  # noqa: F401
from src.models.user import Plan, User  # noqa: F401
from src.models.user_ai_key import AIProvider, UserAIKey  # noqa: F401

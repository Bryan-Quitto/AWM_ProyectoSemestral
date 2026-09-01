using Supabase.Gotrue; using System.Reflection; foreach(var m in typeof(AdminClient).GetMethods()) { if (m.Name == "ListUsers") Console.WriteLine(m.ReturnType.Name); }

' Doutly Print Gateway - Silent 24/7 Background Runner
' Launches node agent.js with no visible console window (WindowStyle = 0)
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Launch node agent.js in the background (0 = hidden window, false = don't wait)
WshShell.Run "cmd /c node agent.js", 0, False

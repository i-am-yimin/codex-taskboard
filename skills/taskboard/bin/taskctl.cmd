@echo off
if "%TASKBOARD_TASKBOARD_RUNTIME%"=="" (
  echo Taskboard Desktop skill is not paired. Run install-taskboard-skill.cmd from the Taskboard Desktop runtime. 1>&2
  exit /b 20
)
"%TASKBOARD_TASKBOARD_RUNTIME%\taskctl.cmd" %*

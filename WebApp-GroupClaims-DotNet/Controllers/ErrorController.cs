﻿using System.Web.Mvc;

namespace WebApp_GroupClaims_DotNet.Controllers
{
    public class ErrorController : Controller
    {
        public ActionResult ShowError(string errorMessage, string signIn)
        {
            ViewBag.SignIn = signIn;
            ViewBag.ErrorMessage = errorMessage;
            return View();
        }

        public ActionResult ReAuth(string redirectUri)
        {
            ViewBag.RedirectUri = redirectUri;
            return View();
        }
    }
}